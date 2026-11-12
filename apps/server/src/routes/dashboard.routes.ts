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
/** 管理员仪表盘切换「员工录入 / 机构录入」的成交；不传为全部 */
const sourceSchema = z.object({ source: z.enum(['STAFF', 'ORG']).optional() });

/* 管理员 / 员工：全局数据 */
router.get('/summary', requirePerm(PERM.DASHBOARD_GLOBAL), async (req, res) => {
  const { range } = rangeSchema.parse(req.query);
  const { source } = sourceSchema.parse(req.query);
  const data = await dashboard.getSummary(range, source);
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

router.get('/trend', requirePerm(PERM.DASHBOARD_FINANCE), async (req, res) => {
  ok(res, await dashboard.getTrend(sourceSchema.parse(req.query).source));
});

router.get('/distribution', requirePerm(PERM.DASHBOARD_GLOBAL), async (req, res) => {
  const { range } = rangeSchema.parse(req.query);
  const { source } = sourceSchema.parse(req.query);
  const data = await dashboard.getDistribution(range, source);
  if (!canSeeFinance(req.user!.permissions)) {
    data.provinces = data.provinces.map((p) => ({ ...p, dealCount: 0, amount: 0, commission: 0 }));
    data.topOrgs = [];
  }
  ok(res, data);
});

const mapSearchSchema = z.object({
  keyword: z.string().trim().max(50).optional(),
  businessType: z.string().trim().max(20).optional(),
});

/** 地图筛选：按机构名称 / 业务类型，展示机构的校区城市分布 */
router.get('/map', requirePerm(PERM.DASHBOARD_GLOBAL), async (req, res) => {
  ok(res, await dashboard.searchMap(mapSearchSchema.parse(req.query)));
});

router.get('/lists', requirePerm(PERM.DASHBOARD_GLOBAL), async (req, res) => {
  const data = await dashboard.getLists(sourceSchema.parse(req.query).source);
  if (!canSeeFinance(req.user!.permissions)) {
    data.pendingDeals = [];
    data.recentDeals = [];
  }
  ok(res, data);
});

/* 员工：我的业务（只统计自己的成交和线索，userId 取自登录态） */
router.get('/me', requirePerm(PERM.DASHBOARD_GLOBAL), async (req, res) => {
  const { range } = rangeSchema.parse(req.query);
  ok(res, await dashboard.getStaffDashboard(req.user!.id, range));
});

/* 机构：仅本机构数据（orgId 取自登录态，不接受前端传参） */
router.get('/my', requirePerm(PERM.DASHBOARD_ORG), async (req, res) => {
  ok(res, await dashboard.getMyOrgDashboard(req.user!.orgId!));
});

export default router;
