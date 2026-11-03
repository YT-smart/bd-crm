import { Router } from 'express';
import { z } from 'zod';
import {
  BUSINESS_TYPES,
  COUNTRIES,
  ORG_LEVELS,
  OrgStatus,
  PERM,
  PROVINCES,
  SettleCycle,
  ORG_STATUS_LABEL,
  SETTLE_CYCLE_LABEL,
  AttachmentCategory,
} from '@bdcrm/shared';
import type { Request } from 'express';
import { ok, Errors } from '../lib/http';
import { requirePerm } from '../middlewares/auth';
import { PASSWORD_RULE } from '../lib/security';
import { canInline, decodeOriginalName, isPdf, mimeOf, orgUploader, removeStoredFile, resolveStorageKey, toStorageKey } from '../lib/storage';
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
  listAttachments,
  createAttachment,
  getAttachment,
  deleteAttachment,
  listStaff,
  exportOrgs,
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

/* ============ 列表与筛选 ============ */

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(50).optional(),
  province: z.enum(PROVINCES).optional(),
  status: z.nativeEnum(OrgStatus).optional(),
  level: z.enum(ORG_LEVELS).optional(),
  sort: z.enum(['createdAt', 'defaultRate', 'name', 'level', 'dealCount']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

router.get('/', requirePerm(PERM.ORG_VIEW), async (req, res) => {
  ok(res, await listOrgs(listSchema.parse(req.query)));
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
  const data = rows.map((o) => ({
    name: o.name,
    province: o.province ?? '',
    city: o.city ?? '',
    status: ORG_STATUS_LABEL[o.status] ?? o.status,
    level: o.level ?? '',
    defaultRate: Number(o.defaultRate),
    businessTypes: o.businessTypes.join('、'),
    settleCycle: o.settleCycle ? SETTLE_CYCLE_LABEL[o.settleCycle] : '',
    contactName: o.contacts[0]?.name ?? '',
    contactPhone: o.contacts[0]?.phone ?? '',
    createdAt: fmtDay(o.createdAt),
  }));
  writeAudit(req, { module: 'org', action: 'export', targetName: `导出 ${data.length} 条` });
  ok(res, data);
});

/* ============ 详情 ============ */

router.get('/:id', requirePerm(...CAN_VIEW), async (req, res) => {
  const detail = await getOrgDetail(req.params.id);
  if (req.user!.role === 'ORG') {
    // 产品佣金比例由员工维护，不对机构账号展示
    detail.products = detail.products.map((p) => ({ ...p, rate: null }));
  }
  ok(res, detail);
});

/* ============ 新增机构 ============ */

const createSchema = z.object({
  name: z.string().trim().min(2, '名称至少 2 个字').max(100),
  province: z.enum(PROVINCES).nullish(),
  city: z.string().trim().max(50).nullish(),
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
  intro: z.string().max(2000).nullish(),
  province: z.enum(PROVINCES).nullish(),
  city: z.string().trim().max(50).nullish(),
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
  businessTypes: z.array(z.enum(BUSINESS_TYPES)).optional(),
  countries: z.array(z.enum(COUNTRIES)).optional(),
  officeCities: z.array(z.string().max(50)).max(30).optional(),
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
  'logo', 'intro', 'province', 'city', 'address', 'website', 'wechat', 'foundedAt', 'scale',
  'businessTypes', 'countries', 'officeCities', 'bankInfo',
]);

router.put('/:id', requirePerm(...CAN_EDIT), async (req, res) => {
  const orgId = req.params.id;
  let input = updateSchema.parse(req.body);
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
  title: z.string().max(50).nullish(),
  phone: z.string().max(20).nullish(),
  wechat: z.string().max(50).nullish(),
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
  type: z.enum(BUSINESS_TYPES),
  priceMin: z.number().min(0).nullish(),
  priceMax: z.number().min(0).nullish(),
  rate: z.number().min(0).max(100).nullish(),
  note: z.string().max(500).nullish(),
});

/** 机构账号不能自行设置产品佣金比例 */
function stripOrgRate<T extends { rate?: unknown }>(req: { user?: { role: string } }, input: T): T {
  if (req.user?.role === 'ORG') {
    const { rate: _rate, ...rest } = input;
    return rest as T;
  }
  return input;
}

router.post('/:id/products', requirePerm(...CAN_EDIT), async (req, res) => {
  const orgId = req.params.id;
  const input = stripOrgRate(req, productSchema.parse(req.body));
  const product = await addProduct(orgId, input);
  writeAudit(req, { module: 'org', action: 'addProduct', targetId: orgId, after: input });
  ok(res, { id: product.id }, 201);
});

router.put('/:id/products/:productId', requirePerm(...CAN_EDIT), async (req, res) => {
  const input = stripOrgRate(req, productSchema.partial().parse(req.body));
  await updateProduct(req.params.id, req.params.productId, input);
  ok(res, null);
});

router.delete('/:id/products/:productId', requirePerm(...CAN_EDIT), async (req, res) => {
  await deleteProduct(req.params.id, req.params.productId);
  ok(res, null);
});

/* ============ 跟进记录 ============ */

const followUpSchema = z.object({
  method: z.enum(['电话', '微信', '面谈', '邮件']),
  content: z.string().trim().min(1, '内容不能为空').max(2000),
  followAt: z.string().datetime(),
});

router.get('/:id/follow-ups', requirePerm(PERM.ORG_VIEW), async (req, res) => {
  ok(res, await listFollowUps(req.params.id));
});

router.post('/:id/follow-ups', requirePerm(PERM.ORG_UPDATE), async (req, res) => {
  const orgId = req.params.id;
  const input = followUpSchema.parse(req.body);
  const fu = await addFollowUp(orgId, req.user!.id, input);
  writeAudit(req, { module: 'org', action: 'addFollowUp', targetId: orgId, after: input });
  ok(res, { id: fu.id }, 201);
});

router.delete('/:id/follow-ups/:fuId', requirePerm(PERM.ORG_UPDATE), async (req, res) => {
  const isAdmin = req.user!.role === 'ADMIN';
  await deleteFollowUp(req.params.fuId, req.user!.id, isAdmin);
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

export default router;
