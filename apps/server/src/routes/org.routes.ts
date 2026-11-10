import { Router } from 'express';
import { z } from 'zod';
import {
  BUSINESS_TYPE_MAX_LEN,
  PRODUCT_LEVELS,
  COUNTRIES,
  ORG_LEVELS,
  OrgStatus,
  PERM,
  PROVINCES,
  SettleCycle,
  ORG_STATUS_LABEL,
  SETTLE_CYCLE_LABEL,
  AttachmentCategory,
  isCity,
} from '@bdcrm/shared';
import type { Request } from 'express';
import { AppError, ok, Errors } from '../lib/http';
import { requirePerm } from '../middlewares/auth';
import { PASSWORD_RULE } from '../lib/security';
import { canInline, decodeOriginalName, isPdf, mimeOf, orgImageUploader, orgUploader, removeStoredFile, resolveStorageKey, toStorageKey } from '../lib/storage';
import { createShareToken } from '../lib/share';
import { fmtDay } from '../lib/date';
import { writeAudit } from '../services/audit.service';
import {
  listOrgs,
  getOrgDetail,
  createOrg,
  updateOrg,
  deleteOrg,
  addContact,
  updateContact,
  deleteContact,
  addProduct,
  updateProduct,
  deleteProduct,
  listFollowUps,
  addFollowUp,
  deleteFollowUp,
  listReviews,
  addReview,
  deleteReview,
  listAttachments,
  createAttachment,
  getAttachment,
  deleteAttachment,
  listStaff,
  exportOrgs,
  setWechatQr,
  getWechatQrKey,
  orgFilterFacets,
} from '../services/org.service';

const router = Router();

/** 员工按 org:* 权限访问；机构账号凭 my-org:manage 访问自己的机构 */
const CAN_VIEW = [PERM.ORG_VIEW, PERM.MY_ORG] as const;
const CAN_EDIT = [PERM.ORG_UPDATE, PERM.MY_ORG] as const;

/** 所有带 :id 的路由：机构账号只能访问自己所属的机构 */
router.param('id', (req, _res, next, id) => {
  if (req.user?.role === 'ORG' && req.user.orgId !== id) throw Errors.forbidden();
  next();
});

/** 城市只能从内置城市库中选择，防止随意填写 */
const citySchema = z.string().trim().refine(isCity, '请从下拉列表中选择城市');
/** 业务类型：常用项或自定义（任意简短文本） */
const businessTypeSchema = z.string().trim().min(1, '业务类型不能为空').max(BUSINESS_TYPE_MAX_LEN, `业务类型请控制在 ${BUSINESS_TYPE_MAX_LEN} 字以内`);
const optionalCity = z.preprocess((v) => (v === '' ? null : v), citySchema.nullish());

/* ============ 列表与筛选 ============ */

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(50).optional(),
  province: z.enum(PROVINCES).optional(),
  status: z.nativeEnum(OrgStatus).optional(),
  level: z.enum(ORG_LEVELS).optional(),
  country: z.enum(COUNTRIES).optional(),
  city: citySchema.optional(),
  businessType: z.string().trim().min(1).max(BUSINESS_TYPE_MAX_LEN).optional(),
  sort: z.enum(['createdAt', 'defaultRate', 'name', 'level', 'dealCount', 'dealRate']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

/** 是否能看机构里跟钱有关的信息（佣金比例、成交额、佣金、合作信息）：管理员；机构账号看自己的 */
const canSeeOrgMoney = (req: Request) => req.user!.role === 'ORG' || req.user!.permissions.includes(PERM.ORG_COOPERATION);

router.get('/', requirePerm(PERM.ORG_VIEW), async (req, res) => {
  const q = listSchema.parse(req.query);
  // 员工不能按佣金排序（不然能从排序推出佣金高低）
  if (!canSeeOrgMoney(req) && q.sort === 'defaultRate') q.sort = undefined;
  const data = await listOrgs(q);
  if (!canSeeOrgMoney(req)) {
    data.list = data.list.map((o) => ({ ...o, defaultRate: 0, dealAmount: 0, commission: 0 }));
  }
  ok(res, data);
});

/* ============ 筛选面板常用城市 / 国家 ============ */

router.get('/filter-facets', requirePerm(PERM.ORG_VIEW), async (_req, res) => {
  ok(res, await orgFilterFacets());
});

/* ============ 员工选项（负责BD下拉） ============ */

router.get('/staff-options', requirePerm(PERM.ORG_VIEW), async (_req, res) => {
  ok(res, await listStaff());
});

/* ============ 导出 ============ */

router.get('/export', requirePerm(PERM.ORG_EXPORT), async (req, res) => {
  const q = listSchema.parse(req.query);
  const rows = await exportOrgs(q);
  // 返回 JSON 数据，前端使用 SheetJS 生成 xlsx
  // 佣金比例、结算周期跟钱有关，只有管理员导出时才带上
  const withCooperation = req.user!.permissions.includes(PERM.ORG_COOPERATION);
  // 直接用中文列名，前端 SheetJS 生成 xlsx 时作为表头
  const data = rows.map((o) => ({
    机构名称: o.name,
    省份: o.province ?? '',
    总部城市: o.city ?? '',
    校区城市: o.officeCities.join('、'),
    覆盖国家和地区: o.countries.join('、'),
    合作状态: ORG_STATUS_LABEL[o.status] ?? o.status,
    等级: o.level ?? '',
    ...(withCooperation ? { '默认佣金(%)': Number(o.defaultRate) } : {}),
    业务类型: o.businessTypes.join('、'),
    ...(withCooperation ? { 结算周期: o.settleCycle ? SETTLE_CYCLE_LABEL[o.settleCycle] : '' } : {}),
    联系人: o.contacts[0]?.name ?? '',
    联系电话: o.contacts[0]?.phone ?? '',
    入驻时间: fmtDay(o.createdAt),
  }));
  writeAudit(req, { module: 'org', action: 'export', targetName: `导出 ${data.length} 条` });
  ok(res, data);
});

/* ============ 详情 ============ */

router.get('/:id', requirePerm(...CAN_VIEW), async (req, res) => {
  const detail = await getOrgDetail(req.params.id);
  // 佣金比例（默认 / 产品）和合作信息员工也能看；整家机构的合作数据只给管理员，机构账号看自己的
  if (!canSeeOrgMoney(req)) {
    detail.stats = { dealCount: 0, dealAmount: 0, commission: 0, settled: 0, unsettled: 0, pendingAudit: 0 };
  }
  ok(res, detail);
});

/* ============ 新增机构 ============ */

const createSchema = z.object({
  name: z.string().trim().min(2, '名称至少 2 个字').max(100),
  province: z.enum(PROVINCES).nullish(),
  city: optionalCity,
  defaultRate: z.number().min(0).max(100),
  ownerId: z.string().cuid().nullish(),
  createAccount: z.boolean().optional(),
  accountUsername: z
    .string()
    .trim()
    .min(3, '登录账号至少 3 个字符')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, '登录账号只能包含字母、数字和下划线')
    .optional(),
  accountName: z.string().trim().max(20).optional(),
  accountPassword: z
    .string()
    .regex(PASSWORD_RULE, '密码至少 8 位，且同时包含字母和数字')
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

router.post('/', requirePerm(PERM.ORG_CREATE), async (req, res) => {
  const input = createSchema.parse(req.body);
  const result = await createOrg(input);
  writeAudit(req, { module: 'org', action: 'create', targetId: result.id, targetName: result.name });
  if (result.account) {
    writeAudit(req, { module: 'user', action: 'create', targetName: `${result.account.name}（${result.account.username}）` });
  }
  ok(res, result, 201);
});

/* ============ 更新机构 ============ */

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  logo: z.string().max(500).nullish(),
  advantage: z.string().trim().max(100, '机构一句话优势请控制在 100 字以内').nullish(),
  intro: z.string().max(2000).nullish(),
  province: z.enum(PROVINCES).nullish(),
  city: optionalCity,
  address: z.string().max(200).nullish(),
  website: z
    .string()
    .url()
    .max(200)
    .refine((v) => /^https?:\/\//i.test(v), '官网需以 http:// 或 https:// 开头')
    .nullish()
    .or(z.literal('')),
  wechat: z.string().max(100).nullish(),
  foundedAt: z.string().datetime().nullish().or(z.literal('')),
  scale: z.string().max(50).nullish(),
  businessTypes: z.array(businessTypeSchema).max(12).optional(),
  countries: z.array(z.enum(COUNTRIES)).optional(),
  officeCities: z.array(citySchema).max(30).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  level: z.enum(ORG_LEVELS).nullish(),
  status: z.nativeEnum(OrgStatus).optional(),
  defaultRate: z.number().min(0).max(100).optional(),
  settleCycle: z.nativeEnum(SettleCycle).nullish(),
  bankInfo: z.object({
    bankName: z.string().max(100).optional(),
    accountName: z.string().max(100).optional(),
    accountNo: z.string().max(50).optional(),
    note: z.string().max(200).optional(),
  }).nullish(),
  contractStart: z.string().datetime().nullish().or(z.literal('')),
  contractEnd: z.string().datetime().nullish().or(z.literal('')),
  ownerId: z.string().cuid().nullish(),
});

/** 机构账号只能维护自己的基本资料与收款账户，佣金/等级/状态/负责 BD/合同等由员工维护 */
const ORG_EDITABLE = new Set([
  'logo', 'advantage', 'intro', 'province', 'city', 'address', 'website', 'wechat', 'foundedAt', 'scale',
  'businessTypes', 'countries', 'officeCities', 'bankInfo',
]);

/** 基本信息必填：提交了这些字段就不能是空的（合作信息等其他卡片单独保存时不带这些字段） */
const REQUIRED_BASIC: Record<string, string> = {
  province: '所在省份', city: '总部城市', address: '详细地址', scale: '机构规模', website: '官网',
  wechat: '公众号', businessTypes: '业务类型', countries: '覆盖国家和地区', officeCities: '校区城市',
  advantage: '机构一句话优势', intro: '机构简介',
};
function assertBasicFilled(input: Record<string, unknown>) {
  const miss = Object.entries(REQUIRED_BASIC)
    .filter(([k]) => k in input)
    .filter(([k]) => {
      const v = input[k];
      return v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
    })
    .map(([, label]) => label);
  if (miss.length) throw new AppError(400, `请把信息填写完整：${miss.join('、')}`);
}

router.put('/:id', requirePerm(...CAN_EDIT), async (req, res) => {
  const orgId = req.params.id;
  let input = updateSchema.parse(req.body);
  assertBasicFilled(input);
  if (req.user!.role === 'ORG') {
    input = Object.fromEntries(Object.entries(input).filter(([k]) => ORG_EDITABLE.has(k))) as typeof input;
  }

  // 处理可空日期字段
  const data: Record<string, unknown> = { ...input };
  if (input.foundedAt === '') data.foundedAt = null;
  else if (input.foundedAt) data.foundedAt = new Date(input.foundedAt);
  if (input.contractStart === '') data.contractStart = null;
  else if (input.contractStart) data.contractStart = new Date(input.contractStart);
  if (input.contractEnd === '') data.contractEnd = null;
  else if (input.contractEnd) data.contractEnd = new Date(input.contractEnd);
  if (input.website === '') data.website = null;

  const updated = await updateOrg(orgId, data);
  writeAudit(req, { module: 'org', action: 'update', targetId: orgId, targetName: updated.name });
  ok(res, { id: orgId });
});

/* ============ 删除机构 ============ */

router.delete('/:id', requirePerm(PERM.ORG_DELETE), async (req, res) => {
  await deleteOrg(req.params.id);
  writeAudit(req, { module: 'org', action: 'delete', targetId: req.params.id });
  ok(res, null);
});

/* ============ 联系人 ============ */

const contactSchema = z.object({
  name: z.string().trim().min(1, '姓名不能为空').max(30),
  title: z.string({ required_error: '职务不能为空' }).trim().min(1, '职务不能为空').max(50),
  phone: z.string({ required_error: '电话不能为空' }).trim().min(1, '电话不能为空').max(20),
  wechat: z.string({ required_error: '微信不能为空' }).trim().min(1, '微信不能为空').max(50),
  email: z.string().email().max(100).nullish().or(z.literal('')),
  isPrimary: z.boolean().optional(),
});

router.post('/:id/contacts', requirePerm(...CAN_EDIT), async (req, res) => {
  const orgId = req.params.id;
  const input = contactSchema.parse(req.body);
  const contact = await addContact(orgId, input);
  writeAudit(req, { module: 'org', action: 'addContact', targetId: orgId, after: input });
  ok(res, { id: contact.id }, 201);
});

router.put('/:id/contacts/:contactId', requirePerm(...CAN_EDIT), async (req, res) => {
  const input = contactSchema.partial().parse(req.body);
  await updateContact(req.params.id, req.params.contactId, input);
  ok(res, null);
});

router.delete('/:id/contacts/:contactId', requirePerm(...CAN_EDIT), async (req, res) => {
  await deleteContact(req.params.id, req.params.contactId);
  ok(res, null);
});

/* ============ 产品与报价 ============ */

const productSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: businessTypeSchema,
  level: z.number({ required_error: '请选择推荐级别', invalid_type_error: '请选择推荐级别' }).int().refine((v) => (PRODUCT_LEVELS as readonly number[]).includes(v), '推荐级别只能是 1-4'),
  priceMin: z.number({ required_error: '请填写最低报价', invalid_type_error: '请填写最低报价' }).min(0),
  priceMax: z.number({ required_error: '请填写最高报价', invalid_type_error: '请填写最高报价' }).min(0),
  rate: z.number().min(0).max(100).nullish(),
  grades: z.array(z.string().trim().min(1).max(20), { required_error: '请选择客户年级' }).min(1, '请选择客户年级').max(20),
  note: z.string({ required_error: '请填写备注说明', invalid_type_error: '请填写备注说明' }).trim().min(1, '请填写备注说明').max(500),
});
const checkPriceRange = (p: { priceMin?: number; priceMax?: number }) => {
  if (p.priceMin != null && p.priceMax != null && p.priceMin > p.priceMax) throw new AppError(400, '最低报价不能高于最高报价');
};

router.post('/:id/products', requirePerm(...CAN_EDIT), async (req, res) => {
  const orgId = req.params.id;
  const input = productSchema.parse(req.body);
  checkPriceRange(input);
  const product = await addProduct(orgId, input);
  writeAudit(req, { module: 'org', action: 'addProduct', targetId: orgId, after: input });
  ok(res, { id: product.id }, 201);
});

router.put('/:id/products/:productId', requirePerm(...CAN_EDIT), async (req, res) => {
  const input = productSchema.partial().parse(req.body);
  checkPriceRange(input);
  await updateProduct(req.params.id, req.params.productId, input);
  writeAudit(req, { module: 'org', action: 'updateProduct', targetId: req.params.id, after: input });
  ok(res, null);
});

router.delete('/:id/products/:productId', requirePerm(...CAN_EDIT), async (req, res) => {
  await deleteProduct(req.params.id, req.params.productId);
  ok(res, null);
});

/* ============ 流量顾问成交记录（原跟进记录） ============
 * 机构账号看不到；管理员看全部；员工只看、只记自己的。
 */

const followUpSchema = z.object({
  method: z.enum(['电话', '微信', '面谈', '邮件']),
  content: z.string().trim().min(1, '内容不能为空').max(2000),
  followAt: z.string().datetime(),
});

router.get('/:id/follow-ups', requirePerm(PERM.ORG_VIEW), async (req, res) => {
  const onlyUserId = req.user!.role === 'ADMIN' ? undefined : req.user!.id;
  ok(res, await listFollowUps(req.params.id, onlyUserId));
});

router.post('/:id/follow-ups', requirePerm(PERM.ORG_VIEW), async (req, res) => {
  const orgId = req.params.id;
  const input = followUpSchema.parse(req.body);
  const fu = await addFollowUp(orgId, req.user!.id, input);
  writeAudit(req, { module: 'org', action: 'addFollowUp', targetId: orgId, after: input });
  ok(res, { id: fu.id }, 201);
});

router.delete('/:id/follow-ups/:fuId', requirePerm(PERM.ORG_VIEW), async (req, res) => {
  const isAdmin = req.user!.role === 'ADMIN';
  await deleteFollowUp(req.params.id, req.params.fuId, req.user!.id, isAdmin);
  ok(res, null);
});

/* ============ 机构评价（内部，机构账号不可见） ============ */

const reviewSchema = z.object({
  content: z.string().trim().min(1, '评价内容不能为空').max(1000, '评价请控制在 1000 字以内'),
});

router.get('/:id/reviews', requirePerm(PERM.ORG_REVIEW), async (req, res) => {
  ok(res, await listReviews(req.params.id));
});

router.post('/:id/reviews', requirePerm(PERM.ORG_REVIEW), async (req, res) => {
  const orgId = req.params.id;
  const { content } = reviewSchema.parse(req.body);
  const r = await addReview(orgId, req.user!.id, content);
  writeAudit(req, { module: 'org', action: 'addReview', targetId: orgId, after: { content } });
  ok(res, { id: r.id }, 201);
});

router.delete('/:id/reviews/:reviewId', requirePerm(PERM.ORG_REVIEW), async (req, res) => {
  await deleteReview(req.params.id, req.params.reviewId, req.user!.id, req.user!.role === 'ADMIN');
  writeAudit(req, { module: 'org', action: 'deleteReview', targetId: req.params.id });
  ok(res, null);
});

/* ============ 附件 ============ */

router.get('/:id/attachments', requirePerm(...CAN_VIEW), async (req, res) => {
  ok(res, await listAttachments(req.params.id));
});

const uploadMw = orgUploader().array('files', 10);
const categorySchema = z.object({ category: z.nativeEnum(AttachmentCategory).default('OTHER') });

router.post(
  '/:id/attachments',
  requirePerm(...CAN_EDIT),
  uploadMw,
  async (req, res) => {
    const orgId = String(req.params.id);
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    try {
      if (!files.length) throw Errors.badRequest('请选择要上传的文件');
      const { category } = categorySchema.parse(req.body);
      const items = [];
      for (const f of files) {
        items.push(
          await createAttachment(orgId, req.user!.id, {
            category,
            name: decodeOriginalName(f.originalname).slice(0, 200),
            url: toStorageKey(f.path),
            size: f.size,
            mime: mimeOf(f.originalname),
          }),
        );
      }
      writeAudit(req, {
        module: 'org',
        action: 'uploadAttachment',
        targetId: orgId,
        after: { category, files: items.map((i) => i.name) },
      });
      ok(res, items, 201);
    } catch (e) {
      // 写库失败时清理已落盘的文件
      await Promise.all(files.map((f) => removeStoredFile(toStorageKey(f.path))));
      throw e;
    }
  },
);

router.get('/:id/attachments/:attId/download', requirePerm(...CAN_VIEW), async (req, res) => {
  const a = await getAttachment(req.params.id, req.params.attId);
  const abs = resolveStorageKey(a.url);
  // 只有图片 / PDF / 纯文本允许内联预览，其余一律作为下载
  const inline = req.query.inline === '1' && canInline(a.name);
  // Chrome 内置 PDF 阅读器会被严格 CSP 拦截，仅对 PDF 放开；类型由服务端按扩展名确定，不会被当作 HTML 解析
  if (inline && isPdf(a.name)) res.removeHeader('Content-Security-Policy');
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(a.name)}`,
  );
  res.setHeader('Content-Type', mimeOf(a.name));
  res.sendFile(abs, { headers: { 'Content-Type': mimeOf(a.name) } }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ code: 404, data: null, message: '文件已丢失' });
  });
});

/** 生成免登录分享链接：默认长期有效（days = 0），附件删除后失效 */
const shareSchema = z.object({ days: z.union([z.literal(1), z.literal(7), z.literal(30), z.literal(0)]).default(0) });

router.post('/:id/attachments/:attId/share', requirePerm(...CAN_VIEW), async (req, res) => {
  const a = await getAttachment(req.params.id, req.params.attId);
  const { days } = shareSchema.parse(req.body ?? {});
  const expiresAt = days ? Date.now() + days * 24 * 3600 * 1000 : 0;
  writeAudit(req, { module: 'org', action: 'shareAttachment', targetId: req.params.id, targetName: a.name, after: { days } });
  ok(res, { token: createShareToken(a.id, expiresAt), expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null });
});

router.delete('/:id/attachments/:attId', requirePerm(...CAN_EDIT), async (req, res) => {
  const a = await getAttachment(req.params.id, req.params.attId);
  // 机构账号只能删除自己上传的附件（合同等员工上传的资料不能被机构删掉）
  if (req.user!.role === 'ORG' && a.uploadedById !== req.user!.id) {
    throw Errors.forbidden('只能删除自己上传的附件');
  }
  await deleteAttachment(req.params.attId);
  writeAudit(req, { module: 'org', action: 'deleteAttachment', targetId: req.params.id, targetName: a.name });
  ok(res, null);
});

/* ============ 公众号二维码 ============ */

router.get('/:id/wechat-qr', requirePerm(...CAN_VIEW), async (req, res) => {
  const key = await getWechatQrKey(req.params.id);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.sendFile(resolveStorageKey(key), { headers: { 'Content-Type': mimeOf(key) } }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ code: 404, data: null, message: '文件已丢失' });
  });
});

router.post('/:id/wechat-qr', requirePerm(...CAN_EDIT), orgImageUploader().single('file'), async (req, res) => {
  const f = req.file;
  if (!f) throw Errors.badRequest('请选择二维码图片');
  try {
    await setWechatQr(String(req.params.id), toStorageKey(f.path));
  } catch (e) {
    await removeStoredFile(toStorageKey(f.path));
    throw e;
  }
  writeAudit(req, { module: 'org', action: 'update', targetId: String(req.params.id), targetName: '上传公众号二维码' });
  ok(res, null, 201);
});

router.delete('/:id/wechat-qr', requirePerm(...CAN_EDIT), async (req, res) => {
  await setWechatQr(req.params.id, null);
  writeAudit(req, { module: 'org', action: 'update', targetId: req.params.id, targetName: '删除公众号二维码' });
  ok(res, null);
});

export default router;
