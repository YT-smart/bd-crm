import { Router } from 'express';
import { z } from 'zod';
import { DealStatus, DEAL_STATUS_LABEL, PERM } from '@bdcrm/shared';
import { ok, Errors } from '../lib/http';
import { requirePerm } from '../middlewares/auth';
import { writeAudit } from '../services/audit.service';
import { DAY_RE, fmtDay } from '../lib/date';
import {
  listDeals,
  getDealSummary,
  getDealOverview,
  createDeal,
  updateDeal,
  settleDeals,
  revokeSettle,
  listOrgOptions,
  exportDeals,
  type DealScope,
} from '../services/deal.service';
import type { Request } from 'express';

const router = Router();

/** 当前账号能看到的成交范围 */
function dealScope(req: Request): DealScope {
  const u = req.user!;
  if (u.role === 'ORG') return { orgId: u.orgId! };
  if (!u.permissions.includes(PERM.DEAL_VIEW_ALL)) return { userId: u.id };
  return {};
}

/* ============ 统计概览 ============ */

router.get('/summary', requirePerm(PERM.DEAL_VIEW), async (req, res) => {
  ok(res, await getDealSummary(parseQuery(req), dealScope(req)));
});

/* 成交概览：成交额、佣金、成交率等经营数据，仅管理员 */
router.get('/overview', requirePerm(PERM.DASHBOARD_FINANCE), async (_req, res) => {
  ok(res, await getDealOverview());
});

/* ============ 机构选项（录入下拉） ============ */

router.get('/org-options', requirePerm(PERM.DEAL_CREATE), async (req, res) => {
  // 机构账号只能拿到自己机构（含产品比例），不能看到其他机构的佣金条款
  const scopeOrgId = req.user!.role === 'ORG' ? req.user!.orgId! : undefined;
  ok(res, await listOrgOptions(scopeOrgId));
});

/* ============ 导出 ============ */

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(50).optional(),
  orgId: z.string().cuid().optional(),
  status: z.nativeEnum(DealStatus).optional(),
  startDate: z.string().regex(DAY_RE, '日期格式应为 YYYY-MM-DD').optional(),
  endDate: z.string().regex(DAY_RE, '日期格式应为 YYYY-MM-DD').optional(),
  sort: z.enum(['dealAt', 'amount', 'commission', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  creatorType: z.enum(['ORG', 'STAFF']).optional(),
  creatorId: z.string().cuid().optional(),
});

/** 解析查询条件；按录入方 / 录入人筛选只给能看全部成交的管理员 */
function parseQuery(req: Request) {
  const q = querySchema.parse(req.query);
  if (!req.user!.permissions.includes(PERM.DEAL_VIEW_ALL)) {
    delete q.creatorType;
    delete q.creatorId;
  }
  return q;
}

router.get('/export', requirePerm(PERM.DEAL_EXPORT), async (req, res) => {
  const q = parseQuery(req);
  const rows = await exportDeals(q, dealScope(req));

  const data = rows.map((d) => ({
    orgName: d.org.name,
    studentName: d.studentName,
    productName: d.product?.name ?? '',
    dealAt: fmtDay(d.dealAt),
    amount: Number(d.amount),
    rate: Number(d.rate),
    commission: Number(d.commission),
    status: DEAL_STATUS_LABEL[d.status] ?? d.status,
    createdBy: d.createdBy.name,
    settledAt: fmtDay(d.settledAt),
    note: d.note ?? '',
  }));
  writeAudit(req, { module: 'deal', action: 'export', targetName: `导出 ${data.length} 条` });
  ok(res, data);
});

/* ============ 列表 ============ */

router.get('/', requirePerm(PERM.DEAL_VIEW), async (req, res) => {
  const q = parseQuery(req);
  ok(res, await listDeals(q, dealScope(req)));
});

/* ============ 录入成交 ============ */

const createSchema = z.object({
  orgId: z.string().cuid(),
  productId: z.string().cuid().nullish(),
  studentName: z.string().trim().min(1, '学生姓名不能为空').max(50),
  studentPhone: z.string().max(20).nullish(),
  dealAt: z.string().datetime({ message: '成交日期格式有误' }),
  amount: z.number().min(0, '成交金额不能为负'),
  rate: z.number().min(0).max(100),
  commission: z.number().min(0),
  note: z.string().max(500).nullish(),
});

router.post('/', requirePerm(PERM.DEAL_CREATE), async (req, res) => {
  const input = createSchema.parse(req.body);

  // 机构角色只能为自己的机构录入
  if (req.user!.role === 'ORG' && input.orgId !== req.user!.orgId) {
    throw Errors.forbidden('只能为本机构录入成交');
  }

  // 只有管理员能自定佣金比例 / 金额；员工、机构按合作约定比例计算
  const deal = await createDeal({ ...input, createdById: req.user!.id, enforceAgreedRate: req.user!.role !== 'ADMIN' });
  writeAudit(req, {
    module: 'deal',
    action: 'create',
    targetId: deal.id,
    targetName: `${input.studentName}`,
    after: { orgId: input.orgId, amount: input.amount, commission: input.commission },
  });
  ok(res, { id: deal.id }, 201);
});

/* ============ 修改成交 ============ */

const updateSchema = z.object({
  productId: z.string().cuid().nullish(),
  studentName: z.string().trim().min(1).max(50).optional(),
  studentPhone: z.string().max(20).nullish(),
  dealAt: z.string().datetime().optional(),
  amount: z.number().min(0).optional(),
  rate: z.number().min(0).max(100).optional(),
  commission: z.number().min(0).optional(),
  note: z.string().max(500).nullish(),
});

router.put('/:id', requirePerm(PERM.DEAL_CREATE), async (req, res) => {
  const input = updateSchema.parse(req.body);
  const u = req.user!;
  await updateDeal(req.params.id, input, {
    // 机构只能改本机构的；员工只能改自己录入的
    orgId: u.role === 'ORG' ? u.orgId! : undefined,
    userId: u.role === 'STAFF' ? u.id : undefined,
    enforceAgreedRate: u.role !== 'ADMIN',
  });
  writeAudit(req, { module: 'deal', action: 'update', targetId: req.params.id, after: input });
  ok(res, { id: req.params.id });
});

/* ============ 结算（仅管理员） ============ */

const settleSchema = z.object({
  dealIds: z.array(z.string().cuid()).min(1).max(100),
  settledAt: z.string().datetime(),
  settleNote: z.string().max(500).optional(),
});

router.post('/settle', requirePerm(PERM.DEAL_SETTLE), async (req, res) => {
  const { dealIds, settledAt, settleNote } = settleSchema.parse(req.body);
  const result = await settleDeals(dealIds, req.user!.id, settledAt, settleNote);
  writeAudit(req, { module: 'deal', action: 'settle', targetName: `${result.updated} 条` });
  ok(res, result);
});

/* ============ 撤销结算（仅管理员） ============ */

const revokeSchema = z.object({
  reason: z.string().trim().min(1, '撤销原因不能为空').max(500),
});

router.post('/:id/revoke-settle', requirePerm(PERM.DEAL_SETTLE), async (req, res) => {
  const { reason } = revokeSchema.parse(req.body);
  const deal = await revokeSettle(req.params.id, reason);
  writeAudit(req, {
    module: 'deal',
    action: 'revokeSettle',
    targetId: req.params.id,
    after: { reason },
  });
  ok(res, { status: deal.status });
});

export default router;
