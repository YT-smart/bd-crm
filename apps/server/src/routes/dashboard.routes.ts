import { Router } from 'express';
import { z } from 'zod';
import { PERM } from '@bdcrm/shared';
import { ok } from '../lib/http';
import { requirePerm } from '../middlewares/auth';
import * as dashboard from '../services/dashboard.service';

const router = Router();

const rangeSchema = z.object({
  range: z.enum(['month', 'quarter', 'year']).default('month'),
});

/* 管理员 / 员工：全局数据 */
router.get('/summary', requirePerm(PERM.DASHBOARD_GLOBAL), async (req, res) => {
  const { range } = rangeSchema.parse(req.query);
  ok(res, await dashboard.getSummary(range));
});

router.get('/trend', requirePerm(PERM.DASHBOARD_GLOBAL), async (_req, res) => {
  ok(res, await dashboard.getTrend());
});

router.get('/distribution', requirePerm(PERM.DASHBOARD_GLOBAL), async (req, res) => {
  const { range } = rangeSchema.parse(req.query);
  ok(res, await dashboard.getDistribution(range));
});

router.get('/lists', requirePerm(PERM.DASHBOARD_GLOBAL), async (_req, res) => {
  ok(res, await dashboard.getLists());
});

/* 机构：仅本机构数据（orgId 取自登录态，不接受前端传参） */
router.get('/my', requirePerm(PERM.DASHBOARD_ORG), async (req, res) => {
  ok(res, await dashboard.getMyOrgDashboard(req.user!.orgId!));
});

export default router;
