import { Prisma } from '@prisma/client';
import {
  APPROVED_DEAL_STATUSES,
  computeCompleteness,
  type DashboardDistribution,
  type DashboardLists,
  type DashboardRange,
  type DashboardSummary,
  type DealSource,
  type DealBrief,
  type MapAreaStat,
  type MapCityStat,
  type MapSearchQuery,
  type MapSearchResult,
  PROVINCE_OF_CITY,
  type MetricWithDelta,
  type MyOrgDashboard,
  type ProvinceStat,
  type StaffDashboard,
  type TrendPoint,
  LEAD_PUSH_STATUS,
} from '@bdcrm/shared';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { Errors } from '../lib/http';
import { sourceSql, sourceWhere } from '../lib/dealSource';
import { deltaPercent, lastMonths, monthStart, resolveRange } from '../lib/date';

const APPROVED = [...APPROVED_DEAL_STATUSES];
const num = (v: Prisma.Decimal | number | null | undefined) => (v == null ? 0 : Number(v));

/** 数据库中 DateTime 以 UTC 存储，按月分组前先转为北京时间 */
const localTs = (col: string) => Prisma.raw(`("${col}" AT TIME ZONE 'UTC' AT TIME ZONE '${config.dbTimezone}')`);
const APPROVED_SQL = Prisma.raw(`('PENDING_PAYMENT','SETTLED')`);

function metric(value: number, previous: number): MetricWithDelta {
  return { value, previous, delta: deltaPercent(value, previous) };
}

/* ---------------- 指标卡 ---------------- */

export async function getSummary(range: DashboardRange, source?: DealSource): Promise<DashboardSummary> {
  const r = resolveRange(range);
  const src = sourceWhere(source);

  const dealAgg = (from: Date, to: Date) =>
    prisma.deal.aggregate({
      where: { ...src, status: { in: APPROVED }, dealAt: { gte: from, lt: to } },
      _count: { _all: true },
      _sum: { amount: true },
    });
  const incomeAgg = (from: Date, to: Date) =>
    prisma.deal.aggregate({
      where: { ...src, status: 'SETTLED', settledAt: { gte: from, lt: to } },
      _sum: { commission: true },
    });
  const orgNew = (from: Date, to: Date) =>
    prisma.org.count({ where: { deletedAt: null, createdAt: { gte: from, lt: to } } });

  const [orgTotal, orgCur, orgPrev, dealCur, dealPrev, incCur, incPrev, receivable] =
    await Promise.all([
      prisma.org.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      orgNew(r.start, r.end),
      orgNew(r.prevStart, r.prevEnd),
      dealAgg(r.start, r.end),
      dealAgg(r.prevStart, r.prevEnd),
      incomeAgg(r.start, r.end),
      incomeAgg(r.prevStart, r.prevEnd),
      prisma.deal.aggregate({
        where: { ...src, status: 'PENDING_PAYMENT' },
        _count: { _all: true },
        _sum: { commission: true },
      }),
    ]);

  return {
    range,
    orgTotal,
    orgNew: metric(orgCur, orgPrev),
    dealCount: metric(dealCur._count._all, dealPrev._count._all),
    dealAmount: metric(num(dealCur._sum.amount), num(dealPrev._sum.amount)),
    commissionIncome: metric(num(incCur._sum.commission), num(incPrev._sum.commission)),
    receivable: { amount: num(receivable._sum.commission), count: receivable._count._all },
  };
}

/* ---------------- 近 12 个月趋势 ---------------- */

export async function getTrend(source?: DealSource): Promise<TrendPoint[]> {
  const src = sourceSql(source);
  const months = lastMonths(12);
  const from = monthStart(-11);

  const [deals, settled, orgs] = await Promise.all([
    prisma.$queryRaw<{ month: string; deal_count: number; amount: number; commission: number }[]>`
      SELECT to_char(date_trunc('month', ${localTs('dealAt')}), 'YYYY-MM') AS month,
             COUNT(*)::int AS deal_count,
             COALESCE(SUM(amount), 0)::float8 AS amount,
             COALESCE(SUM(commission), 0)::float8 AS commission
      FROM "Deal"
      WHERE status IN ${APPROVED_SQL} AND "dealAt" >= ${from} ${src}
      GROUP BY 1`,
    prisma.$queryRaw<{ month: string; settled: number }[]>`
      SELECT to_char(date_trunc('month', ${localTs('settledAt')}), 'YYYY-MM') AS month,
             COALESCE(SUM(commission), 0)::float8 AS settled
      FROM "Deal"
      WHERE status = 'SETTLED' AND "settledAt" >= ${from} ${src}
      GROUP BY 1`,
    prisma.$queryRaw<{ month: string; new_orgs: number }[]>`
      SELECT to_char(date_trunc('month', ${localTs('createdAt')}), 'YYYY-MM') AS month,
             COUNT(*)::int AS new_orgs
      FROM "Org"
      WHERE "deletedAt" IS NULL AND "createdAt" >= ${from}
      GROUP BY 1`,
  ]);

  const dm = new Map(deals.map((d) => [d.month, d]));
  const sm = new Map(settled.map((d) => [d.month, d.settled]));
  const om = new Map(orgs.map((d) => [d.month, d.new_orgs]));

  return months.map((month) => ({
    month,
    dealCount: dm.get(month)?.deal_count ?? 0,
    amount: dm.get(month)?.amount ?? 0,
    commission: dm.get(month)?.commission ?? 0,
    settled: sm.get(month) ?? 0,
    newOrgs: om.get(month) ?? 0,
  }));
}

/* ---------------- 分布：省份 / 业务类型 / Top 机构 ---------------- */

interface ProvinceRow {
  name: string;
  count: number;
  active: number;
  deal_count: number;
  amount: number;
  commission: number;
}

export async function getDistribution(range: DashboardRange, source?: DealSource): Promise<DashboardDistribution> {
  const r = resolveRange(range);

  const [provinceRows, cityRows, typeRows, topRows] = await Promise.all([
    prisma.$queryRaw<ProvinceRow[]>`
      SELECT o.province AS name,
             COUNT(*)::int AS count,
             (COUNT(*) FILTER (WHERE o.status = 'ACTIVE'))::int AS active,
             COALESCE(SUM(d.deal_count), 0)::int AS deal_count,
             COALESCE(SUM(d.amount), 0)::float8 AS amount,
             COALESCE(SUM(d.commission), 0)::float8 AS commission
      FROM "Org" o
      LEFT JOIN (
        SELECT "orgId", COUNT(*) AS deal_count, SUM(amount) AS amount, SUM(commission) AS commission
        FROM "Deal" WHERE status IN ${APPROVED_SQL} ${sourceSql(source)}
        GROUP BY "orgId"
      ) d ON d."orgId" = o.id
      WHERE o."deletedAt" IS NULL AND o.province IS NOT NULL
      GROUP BY o.province
      ORDER BY count DESC`,
    prisma.$queryRaw<{ province: string; city: string; count: number }[]>`
      SELECT province, city, COUNT(*)::int AS count
      FROM "Org"
      WHERE "deletedAt" IS NULL AND province IS NOT NULL AND city IS NOT NULL
      GROUP BY province, city
      ORDER BY count DESC`,
    prisma.$queryRaw<{ name: string; value: number }[]>`
      SELECT t AS name, COUNT(*)::int AS value
      FROM "Org", unnest("businessTypes") AS t
      WHERE "deletedAt" IS NULL
      GROUP BY t
      ORDER BY value DESC`,
    prisma.$queryRaw<{ id: string; name: string; deal_count: number; amount: number; commission: number }[]>`
      SELECT o.id, o.name,
             COUNT(d.id)::int AS deal_count,
             COALESCE(SUM(d.amount), 0)::float8 AS amount,
             COALESCE(SUM(d.commission), 0)::float8 AS commission
      FROM "Deal" d
      JOIN "Org" o ON o.id = d."orgId"
      WHERE d.status IN ${APPROVED_SQL} AND d."dealAt" >= ${r.start} AND o."deletedAt" IS NULL ${sourceSql(source, 'd')}
      GROUP BY o.id, o.name
      ORDER BY commission DESC
      LIMIT 10`,
  ]);

  const citiesByProvince = new Map<string, string[]>();
  for (const c of cityRows) {
    const arr = citiesByProvince.get(c.province) ?? [];
    if (arr.length < 3) arr.push(c.city);
    citiesByProvince.set(c.province, arr);
  }

  return {
    provinces: provinceRows.map(({ deal_count, ...p }): ProvinceStat => ({
      ...p,
      dealCount: deal_count,
      topCities: citiesByProvince.get(p.name) ?? [],
    })),
    businessTypes: typeRows,
    topOrgs: topRows.map((t) => ({
      id: t.id,
      name: t.name,
      dealCount: t.deal_count,
      amount: t.amount,
      commission: t.commission,
    })),
  };
}

/* ---------------- 地图筛选 ---------------- */

const MAP_ORG_NAMES = 8;

export async function searchMap(q: MapSearchQuery): Promise<MapSearchResult> {
  const where: Prisma.OrgWhereInput = { deletedAt: null };
  if (q.keyword) where.name = { contains: q.keyword, mode: 'insensitive' };
  // 业务类型：机构开展的业务，或机构任一产品属于该类型
  if (q.businessType) {
    where.OR = [{ businessTypes: { has: q.businessType } }, { products: { some: { type: q.businessType } } }];
  }
  const orgs = await prisma.org.findMany({
    where,
    select: { id: true, name: true, city: true, officeCities: true },
    orderBy: { name: 'asc' },
  });

  const cityMap = new Map<string, MapCityStat>();
  const provMap = new Map<string, MapAreaStat>();
  const add = <T extends MapAreaStat>(m: Map<string, T>, key: string, init: () => T, orgName: string) => {
    const v = m.get(key) ?? init();
    v.count += 1;
    if (v.orgs.length < MAP_ORG_NAMES) v.orgs.push(orgName);
    m.set(key, v);
  };

  const list = orgs.map((o) => {
    // 校区城市（含总部城市），去重
    const cities = [...new Set([o.city, ...o.officeCities].filter((c): c is string => !!c && !!PROVINCE_OF_CITY[c]))];
    const provinces = new Set<string>();
    for (const c of cities) {
      const p = PROVINCE_OF_CITY[c];
      provinces.add(p);
      add(cityMap, c, () => ({ name: c, province: p, count: 0, orgs: [] }), o.name);
    }
    for (const p of provinces) add(provMap, p, () => ({ name: p, count: 0, orgs: [] }), o.name);
    return { id: o.id, name: o.name, cities };
  });

  return {
    orgCount: orgs.length,
    orgs: list.slice(0, 20),
    provinces: [...provMap.values()].sort((a, b) => b.count - a.count),
    cities: [...cityMap.values()].sort((a, b) => b.count - a.count),
  };
}

/* ---------------- 列表区 ---------------- */

const dealBriefSelect = {
  id: true,
  orgId: true,
  studentName: true,
  amount: true,
  commission: true,
  status: true,
  dealAt: true,
  createdAt: true,
  org: { select: { name: true } },
} satisfies Prisma.DealSelect;

type DealBriefRow = Prisma.DealGetPayload<{ select: typeof dealBriefSelect }>;

function toDealBrief(d: DealBriefRow): DealBrief {
  return {
    id: d.id,
    orgId: d.orgId,
    orgName: d.org.name,
    studentName: d.studentName,
    amount: num(d.amount),
    commission: num(d.commission),
    status: d.status,
    dealAt: d.dealAt.toISOString(),
    createdAt: d.createdAt.toISOString(),
  };
}

export async function getLists(source?: DealSource): Promise<DashboardLists> {
  const src = sourceWhere(source);
  const [pending, recent, incomplete] = await Promise.all([
    prisma.deal.findMany({
      where: { ...src, status: 'PENDING_PAYMENT' },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: dealBriefSelect,
    }),
    prisma.deal.findMany({
      where: { ...src, status: { in: APPROVED } },
      orderBy: { dealAt: 'desc' },
      take: 6,
      select: dealBriefSelect,
    }),
    prisma.org.findMany({
      where: { deletedAt: null, completeness: { lt: 70 }, status: { in: ['ACTIVE', 'NEGOTIATING'] } },
      orderBy: [{ completeness: 'asc' }, { createdAt: 'desc' }],
      take: 6,
      select: { id: true, name: true, city: true, completeness: true, status: true },
    }),
  ]);
  return {
    pendingDeals: pending.map(toDealBrief),
    recentDeals: recent.map(toDealBrief),
    incompleteOrgs: incomplete,
  };
}

/* ---------------- 员工视图：我的业务 ---------------- */

/** 超过这么多天没跟进的线索算「待跟进」 */
const LEAD_STALE_DAYS = 7;

/** userId 取自登录态：只统计本人录入的成交、本人录入或分给本人的线索 */
export async function getStaffDashboard(userId: string, range: DashboardRange): Promise<StaffDashboard> {
  const r = resolveRange(range);
  const mine = { createdById: userId };
  const approved = { ...mine, status: { in: APPROVED } };
  const dealAgg = (from: Date, to: Date) =>
    prisma.deal.aggregate({
      where: { ...approved, dealAt: { gte: from, lt: to } },
      _count: { _all: true },
      _sum: { amount: true, commission: true },
    });
  const leadScope: Prisma.LeadWhereInput = { OR: [{ createdById: userId }, { assigneeId: userId }] };
  const stale = new Date(Date.now() - LEAD_STALE_DAYS * 86400_000);
  const months = lastMonths(12);
  const from = monthStart(-11);

  const [cur, prev, receivable, settled, recent, trendRows, topRows, leadGroups, leadNew, needFollow] =
    await Promise.all([
      dealAgg(r.start, r.end),
      dealAgg(r.prevStart, r.prevEnd),
      prisma.deal.aggregate({ where: { ...mine, status: 'PENDING_PAYMENT' }, _count: { _all: true }, _sum: { commission: true } }),
      prisma.deal.aggregate({ where: { ...mine, status: 'SETTLED' }, _sum: { commission: true } }),
      prisma.deal.findMany({ where: approved, orderBy: { createdAt: 'desc' }, take: 6, select: dealBriefSelect }),
      prisma.$queryRaw<{ month: string; deal_count: number; amount: number; commission: number }[]>`
        SELECT to_char(date_trunc('month', ${localTs('dealAt')}), 'YYYY-MM') AS month,
               COUNT(*)::int AS deal_count,
               COALESCE(SUM(amount), 0)::float8 AS amount,
               COALESCE(SUM(commission), 0)::float8 AS commission
        FROM "Deal"
        WHERE status IN ${APPROVED_SQL} AND "createdById" = ${userId} AND "dealAt" >= ${from}
        GROUP BY 1`,
      prisma.$queryRaw<{ id: string; name: string; deal_count: number; amount: number; commission: number }[]>`
        SELECT o.id, o.name,
               COUNT(d.id)::int AS deal_count,
               COALESCE(SUM(d.amount), 0)::float8 AS amount,
               COALESCE(SUM(d.commission), 0)::float8 AS commission
        FROM "Deal" d
        JOIN "Org" o ON o.id = d."orgId"
        WHERE d.status IN ${APPROVED_SQL} AND d."createdById" = ${userId}
          AND d."dealAt" >= ${r.start} AND o."deletedAt" IS NULL
        GROUP BY o.id, o.name
        ORDER BY commission DESC
        LIMIT 5`,
      prisma.lead.groupBy({ by: ['pushStatus'], where: leadScope, _count: { _all: true } }),
      prisma.lead.count({ where: { AND: [leadScope, { createdAt: { gte: r.start, lt: r.end } }] } }),
      prisma.lead.count({
        where: {
          AND: [
            leadScope,
            { dealId: null, pushStatus: { not: '已签约' } },
            { OR: [{ intention: null }, { intention: { notIn: ['放弃', '联系不上', '已签约'] } }] },
            { OR: [{ lastFollowAt: { lt: stale } }, { lastFollowAt: null, createdAt: { lt: stale } }] },
          ],
        },
      }),
    ]);

  const tm = new Map(trendRows.map((d) => [d.month, d]));
  const byStatus: Record<string, number> = {};
  for (const s of LEAD_PUSH_STATUS) byStatus[s] = 0;
  let leadTotal = 0;
  for (const g of leadGroups) {
    byStatus[g.pushStatus] = g._count._all;
    leadTotal += g._count._all;
  }

  return {
    range,
    dealCount: metric(cur._count._all, prev._count._all),
    dealAmount: metric(num(cur._sum.amount), num(prev._sum.amount)),
    commission: metric(num(cur._sum.commission), num(prev._sum.commission)),
    receivable: { amount: num(receivable._sum.commission), count: receivable._count._all },
    settledTotal: num(settled._sum.commission),
    trend: months.map((month) => ({
      month,
      dealCount: tm.get(month)?.deal_count ?? 0,
      amount: tm.get(month)?.amount ?? 0,
      commission: tm.get(month)?.commission ?? 0,
      settled: 0,
      newOrgs: 0,
    })),
    topOrgs: topRows.map((t) => ({ id: t.id, name: t.name, dealCount: t.deal_count, amount: t.amount, commission: t.commission })),
    recentDeals: recent.map(toDealBrief),
    leads: { total: leadTotal, byStatus, newInRange: leadNew, needFollow },
  };
}

/* ---------------- 机构视图 ---------------- */

export async function getMyOrgDashboard(orgId: string): Promise<MyOrgDashboard> {
  const org = await prisma.org.findFirst({
    where: { id: orgId, deletedAt: null },
    include: { _count: { select: { contacts: true, products: true } } },
  });
  if (!org) throw Errors.notFound('机构不存在或已删除');

  const [groups, recent] = await Promise.all([
    prisma.deal.groupBy({
      by: ['status'],
      where: { orgId },
      _count: { _all: true },
      _sum: { amount: true, commission: true },
    }),
    prisma.deal.findMany({ where: { orgId, status: { in: APPROVED } }, orderBy: { createdAt: 'desc' }, take: 8, select: dealBriefSelect }),
  ]);

  const g = (s: string) => groups.find((x) => x.status === s);
  const approved = groups.filter((x) => APPROVED.includes(x.status));
  const { score, missing } = computeCompleteness({ ...org, contactCount: org._count.contacts, productCount: org._count.products });

  return {
    org: {
      id: org.id,
      name: org.name,
      status: org.status,
      level: org.level,
      defaultRate: num(org.defaultRate),
      completeness: score,
      missing,
    },
    totals: {
      dealCount: approved.reduce((s, x) => s + x._count._all, 0),
      amount: approved.reduce((s, x) => s + num(x._sum.amount), 0),
      commission: approved.reduce((s, x) => s + num(x._sum.commission), 0),
      settled: num(g('SETTLED')?._sum.commission),
      unsettled: num(g('PENDING_PAYMENT')?._sum.commission),
      unsettledCount: g('PENDING_PAYMENT')?._count._all ?? 0,
    },
    recentDeals: recent.map(toDealBrief),
  };
}
