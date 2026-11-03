import type { Prisma } from '@prisma/client';
import {
  DealStatus,
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
const round2 = (n: number) => Math.round(n * 100) / 100;

/** 列表 / 导出共用的筛选条件。scopeOrgId 优先级最高，机构账号传入的 orgId 不能覆盖它。 */
function buildDealWhere(q: DealListQuery, scopeOrgId?: string): Prisma.DealWhereInput {
  const where: Prisma.DealWhereInput = {};
  if (scopeOrgId) where.orgId = scopeOrgId;
  else if (q.orgId) where.orgId = q.orgId;
  if (q.status) where.status = q.status;
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
  /** 机构角色只能看自己的 */
  scopeOrgId?: string,
): Promise<PageResult<DealListItem>> {
  const where = buildDealWhere(q, scopeOrgId);

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

/* ============ 统计概览 ============ */

export async function getDealSummary(scopeOrgId?: string): Promise<DealSummary> {
  const where: Prisma.DealWhereInput = scopeOrgId ? { orgId: scopeOrgId } : {};
  const groups = await prisma.deal.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
    _sum: { commission: true },
  });

  const result: DealSummary = {
    total: 0,
    pendingAudit: 0,
    pendingPayment: 0,
    settled: 0,
    rejected: 0,
    pendingPaymentAmount: 0,
    settledAmount: 0,
  };

  for (const g of groups) {
    const cnt = g._count._all;
    const com = num(g._sum.commission);
    result.total += cnt;
    switch (g.status) {
      case DealStatus.PENDING_AUDIT:
        result.pendingAudit = cnt;
        break;
      case DealStatus.PENDING_PAYMENT:
        result.pendingPayment = cnt;
        result.pendingPaymentAmount = com;
        break;
      case DealStatus.SETTLED:
        result.settled = cnt;
        result.settledAmount = com;
        break;
      case DealStatus.REJECTED:
        result.rejected = cnt;
        break;
    }
  }

  return result;
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
      status: DealStatus.PENDING_AUDIT,
    },
  });
}

/* ============ 修改成交（仅待审核/已驳回状态可改） ============ */

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
  /** 机构只能改自己的 */
  scopeOrgId?: string,
) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new AppError(404, '成交记录不存在');
  if (scopeOrgId && deal.orgId !== scopeOrgId) throw new AppError(403, '无权修改');
  if (deal.status !== DealStatus.PENDING_AUDIT && deal.status !== DealStatus.REJECTED) {
    throw new AppError(400, '只能修改待审核或已驳回的成交记录');
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

  if (scopeOrgId) {
    // 机构账号：比例与佣金始终按约定重新计算
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

  // 已驳回修改后重新提交为待审核
  if (deal.status === DealStatus.REJECTED) {
    data.status = DealStatus.PENDING_AUDIT;
    data.rejectReason = null;
  }

  return prisma.deal.update({ where: { id: dealId }, data });
}

/* ============ 审核 ============ */

export async function auditDeal(
  dealId: string,
  action: 'approve' | 'reject',
  auditedById: string,
  rejectReason?: string,
) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal) throw new AppError(404, '成交记录不存在');
  if (deal.status !== DealStatus.PENDING_AUDIT) {
    throw new AppError(400, '只能审核待审核状态的记录');
  }

  if (action === 'reject' && !rejectReason?.trim()) {
    throw new AppError(400, '驳回时必须填写原因');
  }

  // 带状态条件的原子更新，防止两人同时审核同一条
  const { count } = await prisma.deal.updateMany({
    where: { id: dealId, status: DealStatus.PENDING_AUDIT },
    data: {
      status: action === 'approve' ? DealStatus.PENDING_PAYMENT : DealStatus.REJECTED,
      auditedById,
      auditedAt: new Date(),
      rejectReason: action === 'reject' ? rejectReason!.trim() : null,
    },
  });
  if (!count) throw new AppError(409, '该记录已被其他人处理，请刷新');
  return (await prisma.deal.findUnique({ where: { id: dealId } }))!;
}

/** 批量审核通过 */
export async function batchApprove(dealIds: string[], auditedById: string) {
  const result = await prisma.deal.updateMany({
    where: { id: { in: dealIds }, status: DealStatus.PENDING_AUDIT },
    data: {
      status: DealStatus.PENDING_PAYMENT,
      auditedById,
      auditedAt: new Date(),
    },
  });
  return { updated: result.count };
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

export async function exportDeals(q: DealListQuery, scopeOrgId?: string) {
  return prisma.deal.findMany({
    where: buildDealWhere(q, scopeOrgId),
    orderBy: { [q.sort ?? 'dealAt']: q.order ?? 'desc' },
    include: {
      org: { select: { name: true } },
      product: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });
}
