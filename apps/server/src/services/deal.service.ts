import type { Prisma } from '@prisma/client';
import {
  APPROVED_DEAL_STATUSES,
  DealStatus,
  type DealOverview,
  type DealPeriodStat,
  type DealListItem,
  type DealListQuery,
  type DealSummary,
  type OrgOption,
  type PageResult,
} from '@bdcrm/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { dayRange } from '../lib/date';

const num = (v: Prisma.Decimal | null | undefined) => (v == null ? 0 : Number(v));
const APPROVED: readonly DealStatus[] = APPROVED_DEAL_STATUSES;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 数据范围：机构账号只看本机构；员工只看自己录入的成交；管理员看全部。
 * 由路由层根据登录身份生成，前端传的参数不能放宽它。
 */
export interface DealScope {
  orgId?: string;
  userId?: string;
}

export function scopeWhere(scope: DealScope = {}): Prisma.DealWhereInput {
  if (scope.orgId) return { orgId: scope.orgId };
  if (scope.userId) return { createdById: scope.userId };
  return {};
}

/**
 * 列表 / 导出 / 统计共用的筛选条件。
 * 已经没有审核环节：只显示待到账、已结算；以前驳回的记录保留在库中但不再显示。
 */
function buildDealWhere(q: DealListQuery, scope: DealScope = {}, withStatus = true): Prisma.DealWhereInput {
  const where: Prisma.DealWhereInput = { AND: [scopeWhere(scope), { status: { in: [...APPROVED] } }] };
  if (!scope.orgId && q.orgId) where.orgId = q.orgId;
  if (withStatus && q.status) where.status = q.status;
  const range = dayRange(q.startDate, q.endDate);
  if (range) where.dealAt = range;
  if (q.keyword) {
    const kw = q.keyword.trim();
    where.OR = [
      { studentName: { contains: kw, mode: 'insensitive' } },
      { org: { name: { contains: kw, mode: 'insensitive' } } },
    ];
  }
  return where;
}

/* ============ 列表 ============ */

export async function listDeals(
  q: Required<Pick<DealListQuery, 'page' | 'pageSize'>> & DealListQuery,
  scope: DealScope = {},
): Promise<PageResult<DealListItem>> {
  const where = buildDealWhere(q, scope);

  const orderBy: Prisma.DealOrderByWithRelationInput = {
    [q.sort ?? 'createdAt']: q.order ?? 'desc',
  };

  const [total, rows] = await Promise.all([
    prisma.deal.count({ where }),
    prisma.deal.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        org: { select: { name: true } },
        product: { select: { name: true } },
        createdBy: { select: { name: true } },
        auditedBy: { select: { name: true } },
        settledBy: { select: { name: true } },
      },
    }),
  ]);

  return {
    total,
    page: q.page,
    pageSize: q.pageSize,
    list: rows.map((d) => ({
      id: d.id,
      orgId: d.orgId,
      orgName: d.org.name,
      productName: d.product?.name ?? null,
      studentName: d.studentName,
      studentPhone: d.studentPhone,
      dealAt: d.dealAt.toISOString(),
      amount: num(d.amount),
      rate: num(d.rate),
      commission: num(d.commission),
      status: d.status,
      rejectReason: d.rejectReason,
      createdByName: d.createdBy.name,
      auditedByName: d.auditedBy?.name ?? null,
      auditedAt: d.auditedAt?.toISOString() ?? null,
      settledAt: d.settledAt?.toISOString() ?? null,
      settledByName: d.settledBy?.name ?? null,
      settleNote: d.settleNote,
      note: d.note,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

/* ============ 统计概览（跟随筛选条件） ============ */

/**
 * 顶部数字：成交数量、签约金额、佣金、待结算佣金、已结算佣金，按当前筛选（含状态）统计；
 * byStatus 是忽略状态筛选时各状态的数量，用于状态按钮上的数字。
 */
export async function getDealSummary(q: DealListQuery, scope: DealScope = {}): Promise<DealSummary> {
  const groups = await prisma.deal.groupBy({
    by: ['status'],
    where: buildDealWhere(q, scope, false),
    _count: { _all: true },
    _sum: { amount: true, commission: true },
  });
  const result: DealSummary = {
    count: 0,
    amount: 0,
    commission: 0,
    pendingAmount: 0,
    settledAmount: 0,
    byStatus: { total: 0, [DealStatus.PENDING_PAYMENT]: 0, [DealStatus.SETTLED]: 0 },
  };
  for (const g of groups) {
    const cnt = g._count._all;
    result.byStatus[g.status] = cnt;
    result.byStatus.total += cnt;
    if (q.status && g.status !== q.status) continue;
    const com = num(g._sum.commission);
    result.count += cnt;
    result.amount += num(g._sum.amount);
    result.commission += com;
    if (g.status === DealStatus.PENDING_PAYMENT) result.pendingAmount += com;
    if (g.status === DealStatus.SETTLED) result.settledAmount += com;
  }
  result.amount = round2(result.amount);
  result.commission = round2(result.commission);
  result.pendingAmount = round2(result.pendingAmount);
  result.settledAmount = round2(result.settledAmount);
  return result;
}

/* ============ 成交概览（管理员） ============ */

const DAY_MS = 24 * 3600 * 1000;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function emptyStat(): DealPeriodStat {
  return { count: 0, amount: 0, commission: 0, settled: 0, rate: null };
}
function finish(s: DealPeriodStat): DealPeriodStat {
  s.amount = Math.round(s.amount * 100) / 100;
  s.commission = Math.round(s.commission * 100) / 100;
  s.rate = s.count ? Math.round((s.settled / s.count) * 1000) / 10 : null;
  return s;
}

/**
 * 今日 / 本周 / 本月成交，对比上期同一时刻（如本周一至今 vs 上周一至上周同一时刻）。
 * 按成交日期统计；进程时区为北京时间，Date 本地方法即北京时间。
 */
export async function getDealOverview(now = new Date()): Promise<DealOverview> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsedToday = now.getTime() - today.getTime();
  const weekStart = new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY_MS); // 周一
  const lastWeekStart = new Date(weekStart.getTime() - 7 * DAY_MS);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const dailyStart = new Date(today.getTime() - 29 * DAY_MS);
  const from = new Date(Math.min(lastMonthStart.getTime(), lastWeekStart.getTime(), dailyStart.getTime()));

  const [rows, allGroups] = await Promise.all([
    prisma.deal.findMany({
      where: { dealAt: { gte: from, lte: now }, status: { in: [...APPROVED] } },
      select: { dealAt: true, status: true, amount: true, commission: true },
    }),
    prisma.deal.groupBy({ by: ['status'], where: { status: { in: [...APPROVED] } }, _count: { _all: true }, _sum: { amount: true, commission: true } }),
  ]);

  const inRange = (t: number, start: Date, end: number) => t >= start.getTime() && t < end;
  const periods = {
    today: [today, now.getTime() + 1],
    yesterday: [new Date(today.getTime() - DAY_MS), today.getTime() - DAY_MS + elapsedToday + 1],
    week: [weekStart, now.getTime() + 1],
    lastWeek: [lastWeekStart, lastWeekStart.getTime() + (now.getTime() - weekStart.getTime()) + 1],
    month: [monthStart, now.getTime() + 1],
    // 上月同期：上月 1 日至上月同一天同一时刻（不超过上月末）
    lastMonth: [lastMonthStart, Math.min(lastMonthStart.getTime() + (now.getTime() - monthStart.getTime()) + 1, monthStart.getTime())],
  } as const;
  const stats = Object.fromEntries(Object.keys(periods).map((k) => [k, emptyStat()])) as Record<keyof typeof periods, DealPeriodStat>;
  const daily = new Map<string, DealPeriodStat>();
  for (let i = 0; i < 30; i++) daily.set(ymd(new Date(dailyStart.getTime() + i * DAY_MS)), emptyStat());

  for (const r of rows) {
    const t = r.dealAt.getTime();
    const settled = r.status === DealStatus.SETTLED;
    const add = (s: DealPeriodStat) => {
      s.count++;
      s.amount += num(r.amount);
      s.commission += num(r.commission);
      if (settled) s.settled++;
    };
    for (const [k, [start, end]] of Object.entries(periods) as [keyof typeof periods, readonly [Date, number]][]) {
      if (inRange(t, start, end)) add(stats[k]);
    }
    const d = daily.get(ymd(r.dealAt));
    if (d) add(d);
  }

  const all = emptyStat();
  for (const g of allGroups) {
    all.count += g._count._all;
    all.amount += num(g._sum.amount);
    all.commission += num(g._sum.commission);
    if (g.status === DealStatus.SETTLED) all.settled += g._count._all;
  }

  return {
    today: finish(stats.today),
    yesterday: finish(stats.yesterday),
    week: finish(stats.week),
    lastWeek: finish(stats.lastWeek),
    month: finish(stats.month),
    lastMonth: finish(stats.lastMonth),
    all: finish(all),
    ranges: { today: ymd(today), weekStart: ymd(weekStart), monthStart: ymd(monthStart) },
    daily: [...daily.entries()].map(([date, s]) => ({ date, ...finish(s) })),
  };
}

/* ============ 录入成交 ============ */

interface CreateDealInput {
  orgId: string;
  productId?: string | null;
  studentName: string;
  studentPhone?: string | null;
  dealAt: string;
  amount: number;
  rate: number;
  commission: number;
  note?: string | null;
  createdById: string;
  /** 机构账号录入：比例取约定值、佣金由服务端计算，忽略前端传入 */
  enforceAgreedRate?: boolean;
}

export async function createDeal(input: CreateDealInput) {
  // 校验机构存在
  const org = await prisma.org.findFirst({ where: { id: input.orgId, deletedAt: null } });
  if (!org) throw new AppError(404, '机构不存在');

  // 校验产品（如果选了）
  let productRate: number | null = null;
  if (input.productId) {
    const product = await prisma.orgProduct.findFirst({
      where: { id: input.productId, orgId: input.orgId },
    });
    if (!product) throw new AppError(404, '产品不存在');
    productRate = product.rate != null ? num(product.rate) : null;
  }

  let rate = input.rate;
  let commission = input.commission;
  if (input.enforceAgreedRate) {
    rate = productRate ?? num(org.defaultRate);
    commission = round2((input.amount * rate) / 100);
  }

  return prisma.deal.create({
    data: {
      orgId: input.orgId,
      productId: input.productId ?? null,
      studentName: input.studentName,
      studentPhone: input.studentPhone ?? null,
      dealAt: new Date(input.dealAt),
      amount: input.amount,
      rate,
      commission,
      note: input.note ?? null,
      createdById: input.createdById,
      // 没有审核环节，录入后直接待到账
      status: DealStatus.PENDING_PAYMENT,
    },
  });
}

/* ============ 修改成交（到账之前可改） ============ */

export async function updateDeal(
  dealId: string,
  input: {
    productId?: string | null;
    studentName?: string;
    studentPhone?: string | null;
    dealAt?: string;
    amount?: number;
    rate?: number;
    commission?: number;
    note?: string | null;
  },
  /** orgId：机构只能改自己的；userId：员工只能改自己录入的；enforceAgreedRate：按约定比例重算佣金 */
  scope: { orgId?: string; userId?: string; enforceAgreedRate?: boolean } = {},
) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new AppError(404, '成交记录不存在');
  if (scope.orgId && deal.orgId !== scope.orgId) throw new AppError(403, '无权修改');
  if (scope.userId && deal.createdById !== scope.userId) throw new AppError(403, '只能修改自己录入的成交');
  if (deal.status !== DealStatus.PENDING_PAYMENT) {
    throw new AppError(400, '只能修改还没到账的成交记录');
  }

  // 产品必须属于该成交所在机构
  let productRate: number | null | undefined;
  if (input.productId) {
    const product = await prisma.orgProduct.findFirst({ where: { id: input.productId, orgId: deal.orgId } });
    if (!product) throw new AppError(404, '产品不存在');
    productRate = product.rate != null ? num(product.rate) : null;
  }

  const data: Prisma.DealUncheckedUpdateInput = {};
  if (input.productId !== undefined) data.productId = input.productId;
  if (input.studentName) data.studentName = input.studentName;
  if (input.studentPhone !== undefined) data.studentPhone = input.studentPhone;
  if (input.dealAt) data.dealAt = new Date(input.dealAt);
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.note !== undefined) data.note = input.note;

  if (scope.enforceAgreedRate) {
    // 机构、员工：比例与佣金始终按约定重新计算
    const productId = input.productId !== undefined ? input.productId : deal.productId;
    if (productRate === undefined && productId) {
      const p = await prisma.orgProduct.findUnique({ where: { id: productId } });
      productRate = p?.rate != null ? num(p.rate) : null;
    }
    const org = await prisma.org.findUnique({ where: { id: deal.orgId }, select: { defaultRate: true } });
    const rate = (productId ? productRate : null) ?? num(org?.defaultRate);
    const amount = input.amount ?? num(deal.amount);
    data.rate = rate;
    data.commission = round2((amount * rate) / 100);
  } else {
    if (input.rate !== undefined) data.rate = input.rate;
    if (input.commission !== undefined) data.commission = input.commission;
  }

  return prisma.deal.update({ where: { id: dealId }, data });
}

/* ============ 结算 ============ */

export async function settleDeals(
  dealIds: string[],
  settledById: string,
  settledAt: string,
  settleNote?: string,
) {
  // 校验所有记录都处于待到账状态
  const deals = await prisma.deal.findMany({
    where: { id: { in: dealIds } },
    select: { id: true, status: true },
  });

  const invalid = deals.filter((d) => d.status !== DealStatus.PENDING_PAYMENT);
  if (invalid.length) {
    throw new AppError(400, `${invalid.length} 条记录不在"待到账"状态，无法结算`);
  }

  const result = await prisma.deal.updateMany({
    where: { id: { in: dealIds }, status: DealStatus.PENDING_PAYMENT },
    data: {
      status: DealStatus.SETTLED,
      settledById,
      settledAt: new Date(settledAt),
      settleNote: settleNote?.trim() || null,
    },
  });
  return { updated: result.count };
}

/** 撤销结算（仅管理员） */
export async function revokeSettle(dealId: string, reason: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new AppError(404, '成交记录不存在');
  if (deal.status !== DealStatus.SETTLED) {
    throw new AppError(400, '只能撤销已结算的记录');
  }
  if (!reason.trim()) throw new AppError(400, '撤销结算必须填写原因');

  return prisma.deal.update({
    where: { id: dealId },
    data: {
      status: DealStatus.PENDING_PAYMENT,
      settledAt: null,
      settledById: null,
      settleNote: `[撤销] ${reason.trim()}`,
    },
  });
}

/* ============ 机构选项（成交录入下拉） ============ */

export async function listOrgOptions(scopeOrgId?: string): Promise<OrgOption[]> {
  const orgs = await prisma.org.findMany({
    where: scopeOrgId ? { id: scopeOrgId, deletedAt: null } : { deletedAt: null, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      defaultRate: true,
      products: { select: { id: true, name: true, type: true, rate: true } },
    },
    orderBy: { name: 'asc' },
  });

  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    defaultRate: num(o.defaultRate),
    products: o.products.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      rate: p.rate != null ? num(p.rate) : null,
    })),
  }));
}

/* ============ 导出成交数据 ============ */

export async function exportDeals(q: DealListQuery, scope: DealScope = {}) {
  return prisma.deal.findMany({
    where: buildDealWhere(q, scope),
    orderBy: { [q.sort ?? 'dealAt']: q.order ?? 'desc' },
    include: {
      org: { select: { name: true } },
      product: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
}
