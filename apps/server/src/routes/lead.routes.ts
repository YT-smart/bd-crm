import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  LEAD_DEGREES,
  LEAD_FOLLOW_METHODS,
  LEAD_GRADES,
  LEAD_INTENTIONS,
  LEAD_PUSH_STATUS,
  LEAD_WECHAT_STATUS,
  PERM,
} from '@bdcrm/shared';
import { ok } from '../lib/http';
import { requirePerm } from '../middlewares/auth';
import { writeAudit } from '../services/audit.service';
import { DAY_RE, fmtDay } from '../lib/date';
import {
  addFollow,
  assignLeads,
  createLead,
  deleteLead,
  exportLeads,
  getLead,
  leadFilterOptions,
  leadStatusCounts,
  listLeads,
  signLead,
  updateLead,
  type LeadScope,
} from '../services/lead.service';

const router = Router();

/** 管理员看全部；员工只看自己录入或分给自己的 */
function leadScope(req: Request): LeadScope {
  return req.user!.permissions.includes(PERM.LEAD_MANAGE) ? {} : { userId: req.user!.id };
}
const canAssign = (req: Request) => req.user!.permissions.includes(PERM.LEAD_MANAGE);

const day = z.string().regex(DAY_RE, '日期格式应为 YYYY-MM-DD').optional();
const csv = z.string().max(2000).optional();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(50).optional(),
  pushStatus: csv,
  productTags: csv,
  grades: csv,
  degrees: csv,
  wechatStatus: csv,
  regions: csv,
  intentions: csv,
  assigneeIds: csv,
  creatorIds: csv,
  source: z.string().max(50).optional(),
  orgId: z.string().cuid().optional(),
  createdFrom: day,
  createdTo: day,
  updatedFrom: day,
  updatedTo: day,
  assignedFrom: day,
  assignedTo: day,
  sort: z.enum(['createdAt', 'updatedAt', 'assignedAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

/* ============ 列表 / 统计 / 筛选项 / 导出 ============ */

router.get('/', requirePerm(PERM.LEAD_VIEW), async (req, res) => {
  ok(res, await listLeads(querySchema.parse(req.query), leadScope(req)));
});

router.get('/counts', requirePerm(PERM.LEAD_VIEW), async (req, res) => {
  ok(res, await leadStatusCounts(querySchema.parse(req.query), leadScope(req)));
});

router.get('/filter-options', requirePerm(PERM.LEAD_VIEW), async (req, res) => {
  ok(res, await leadFilterOptions(leadScope(req)));
});

router.get('/export', requirePerm(PERM.LEAD_VIEW), async (req, res) => {
  const rows = await exportLeads(querySchema.parse(req.query), leadScope(req));
  const data = rows.map((l) => ({
    学生姓名: l.studentName,
    手机号: l.phone ?? '',
    微信: l.wechat ?? '',
    来源: l.source ?? '',
    产品标签: l.productTags.join('、'),
    就读年级: l.grade ?? '',
    申请学历: l.degree ?? '',
    留学地区: l.regions.join('、'),
    添加微信: l.wechatStatus ?? '',
    意向度: l.intention ?? '',
    推出状态: l.pushStatus,
    跟进机构: l.orgName ?? '',
    跟进人: l.assigneeName ?? '',
    创建人: l.createdByName,
    跟进次数: l.followCount,
    最近跟进: fmtDay(l.lastFollowAt ? new Date(l.lastFollowAt) : null),
    创建时间: fmtDay(new Date(l.createdAt)),
    备注: l.note ?? '',
  }));
  writeAudit(req, { module: 'lead', action: 'export', targetName: `导出 ${data.length} 条` });
  ok(res, data);
});

/* ============ 详情 ============ */

router.get('/:id', requirePerm(PERM.LEAD_VIEW), async (req, res) => {
  ok(res, await getLead(req.params.id, leadScope(req)));
});

/* ============ 新增 / 修改 ============ */

const opt = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).nullish();
const strList = z.array(z.string().trim().min(1).max(20)).max(20);

const leadSchema = z.object({
  studentName: z.string().trim().min(1, '学生姓名不能为空').max(50),
  phone: z.string().trim().max(30).nullish(),
  wechat: z.string().trim().max(50).nullish(),
  source: z.string().trim().max(30).nullish(),
  productTags: strList.optional(),
  grade: opt(LEAD_GRADES),
  degree: opt(LEAD_DEGREES),
  regions: strList.optional(),
  wechatStatus: opt(LEAD_WECHAT_STATUS),
  intention: opt(LEAD_INTENTIONS),
  pushStatus: z.enum(LEAD_PUSH_STATUS).optional(),
  orgId: z.string().cuid().nullish(),
  assigneeId: z.string().cuid().nullish(),
  note: z.string().trim().max(1000).nullish(),
});

router.post('/', requirePerm(PERM.LEAD_EDIT), async (req, res) => {
  const input = leadSchema.parse(req.body);
  const lead = await createLead(input, req.user!.id, canAssign(req));
  writeAudit(req, { module: 'lead', action: 'create', targetId: lead.id, targetName: lead.studentName });
  ok(res, { id: lead.id }, 201);
});

router.put('/:id', requirePerm(PERM.LEAD_EDIT), async (req, res) => {
  const input = leadSchema.partial().parse(req.body);
  const { before, after } = await updateLead(req.params.id, input, leadScope(req), canAssign(req));
  writeAudit(req, {
    module: 'lead',
    action: 'update',
    targetId: after.id,
    targetName: after.studentName,
    before: { pushStatus: before.pushStatus, intention: before.intention, orgId: before.orgId, assigneeId: before.assigneeId },
    after: input,
  });
  ok(res, { id: after.id });
});

/* ============ 分配跟进人 / 删除（仅管理员） ============ */

const assignSchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(200),
  assigneeId: z.string().cuid().nullable(),
});

router.post('/assign', requirePerm(PERM.LEAD_MANAGE), async (req, res) => {
  const { ids, assigneeId } = assignSchema.parse(req.body);
  const r = await assignLeads(ids, assigneeId);
  writeAudit(req, { module: 'lead', action: 'assign', targetName: `${r.updated} 条`, after: { assigneeId } });
  ok(res, r);
});

router.delete('/:id', requirePerm(PERM.LEAD_MANAGE), async (req, res) => {
  const lead = await deleteLead(req.params.id);
  writeAudit(req, { module: 'lead', action: 'delete', targetId: lead.id, targetName: lead.studentName });
  ok(res, null);
});

/* ============ 跟进记录 ============ */

const followSchema = z.object({
  method: z.enum(LEAD_FOLLOW_METHODS),
  content: z.string().trim().min(1, '跟进内容不能为空').max(1000),
});

router.post('/:id/follows', requirePerm(PERM.LEAD_EDIT), async (req, res) => {
  const { method, content } = followSchema.parse(req.body);
  const f = await addFollow(req.params.id, method, content, req.user!.id, leadScope(req));
  ok(res, { id: f.id }, 201);
});

/* ============ 登记签约（生成待审核成交，需录入成交权限） ============ */

const signSchema = z.object({
  orgId: z.string().cuid(),
  productId: z.string().cuid().nullish(),
  dealAt: z.string().datetime({ message: '成交日期格式有误' }),
  amount: z.number().positive('成交金额须大于 0'),
  rate: z.number().min(0).max(100),
  commission: z.number().min(0),
  note: z.string().max(500).nullish(),
});

router.post('/:id/sign', requirePerm(PERM.LEAD_EDIT), requirePerm(PERM.DEAL_CREATE), async (req, res) => {
  const input = signSchema.parse(req.body);
  const deal = await signLead(req.params.id, input, req.user!.id, leadScope(req));
  writeAudit(req, {
    module: 'lead',
    action: 'sign',
    targetId: req.params.id,
    after: { dealId: deal.id, orgId: input.orgId, amount: input.amount, commission: input.commission },
  });
  ok(res, { dealId: deal.id }, 201);
});

export default router;
