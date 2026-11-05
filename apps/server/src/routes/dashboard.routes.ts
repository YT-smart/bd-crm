import { Router } from 'express';
import { z } from 'zod';
import { PERM } from '@bdcrm/shared';
import { ok } from '../lib/http';
import { requirePerm } from '../middlewares/auth';
import * as dashboard from '../services/dashboard.service';

const router = Router();

/** 成交笔数、成交额、佣金等经营数据仅管理员可见；员工只返回机构维度的数据 */
const canSeeFinance = (perms: readonly string[]) => perms.includes(PERM.DASHBOARD_FINANCE);
const ZERO_METRIC = { value: 0, previous: 0, delta: null };

const rangeSchema = z.object({
  range: z.enum(['month', 'quarter', 'year']).default('month'),
});

/* 管理员 / 员工：全局数据 */
router.get('/summary', requirePerm(PERM.DASHBOARD_GLOBAL), async (req, res) => {
  const { range } = rangeSchema.parse(req.query);
  const data = await dashboard.getSummary(range);
  if (!canSeeFinance(req.user!.permissions)) {
    Object.assign(data, {
      dealCount: ZERO_METRIC,
      dealAmount: ZERO_METRIC,
      commissionIncome: ZERO_METRIC,
      receivable: { amount: 0, count: 0 },
    });
  }
  ok(res, data);
});

router.get('/trend', requirePerm(PERM.DASHBOARD_FINANCE), async (_req, res) => {
  ok(res, await dashboard.getTrend());
});

router.get('/distribution', requirePerm(PERM.DASHBOARD_GLOBAL), async (req, res) => {
  const { range } = rangeSchema.parse(req.query);
  const data = await dashboard.getDistribution(range);
  if (!canSeeFinance(req.user!.permissions)) {
    data.provinces = data.provinces.map((p) => ({ ...p, dealCount: 0, amount: 0, commission: 0 }));
    data.topOrgs = [];
  }
  ok(res, data);
});

router.get('/lists', requirePerm(PERM.DASHBOARD_GLOBAL), async (req, res) => {
  const data = await dashboard.getLists();
  if (!canSeeFinance(req.user!.permissions)) {
    data.pendingDeals = [];
    data.recentDeals = [];
  }
  ok(res, data);
});

/* 机构：仅本机构数据（orgId 取自登录态，不接受前端传参） */
router.get('/my', requirePerm(PERM.DASHBOARD_ORG), async (req, res) => {
  ok(res, await dashboard.getMyOrgDashboard(req.user!.orgId!));
});

export default router;
