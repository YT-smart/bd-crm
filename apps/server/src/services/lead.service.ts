import type { Prisma } from '@prisma/client';
import type {
  LeadDetail,
  LeadInput,
  LeadListItem,
  LeadListQuery,
  LeadSignInput,
  LeadStatusCounts,
  PageResult,
} from '@bdcrm/shared';
import { LEAD_PUSH_STATUS } from '@bdcrm/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { dayRange } from '../lib/date';
import { createDeal } from './deal.service';

/**
 * 数据范围：管理员看全部；员工只看自己录入的、或分配给自己跟进的线索。
 * 由路由层根据登录身份生成，前端参数不能放宽它。
 */
export interface LeadScope {
  userId?: string;
}

function scopeWhere(scope: LeadScope): Prisma.LeadWhereInput {
  if (!scope.userId) return {};
  return { OR: [{ createdById: scope.userId }, { assigneeId: scope.userId }] };
}

const split = (v?: string) =>
  v
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/** 除推出状态外的筛选条件（推出状态单独拼，方便统计各状态数量） */
function buildWhere(q: LeadListQuery, scope: LeadScope, withStatus = true): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [scopeWhere(scope)];

  const inList = (field: 'grade' | 'degree' | 'wechatStatus' | 'intention' | 'assigneeId' | 'createdById', v?: string) => {
    const arr = split(v);
    if (!arr.length) return;
    // 「未明确」也匹配没填的
    if ((field === 'grade' || field === 'degree') && arr.includes('未明确')) {
      and.push({ OR: [{ [field]: { in: arr } }, { [field]: null }] });
    } else {
      and.push({ [field]: { in: arr } });
    }
  };

  if (withStatus) {
    const st = split(q.pushStatus);
    if (st.length) and.push({ pushStatus: { in: st } });
  }
  const tags = split(q.productTags);
  if (tags.length) and.push({ productTags: { hasSome: tags } });
  const regions = split(q.regions);
  if (regions.length) and.push({ regions: { hasSome: regions } });
  inList('grade', q.grades);
  inList('degree', q.degrees);
  inList('wechatStatus', q.wechatStatus);
  inList('intention', q.intentions);
  inList('assigneeId', q.assigneeIds);
  inList('createdById', q.creatorIds);
  if (q.source) and.push({ source: q.source });
  if (q.orgId) and.push({ orgId: q.orgId });

  const created = dayRange(q.createdFrom, q.createdTo);
  if (created) and.push({ createdAt: created });
  const updated = dayRange(q.updatedFrom, q.updatedTo);
  if (updated) and.push({ updatedAt: updated });
  const assigned = dayRange(q.assignedFrom, q.assignedTo);
  if (assigned) and.push({ assignedAt: assigned });

  if (q.keyword) {
    const kw = q.keyword.trim();
    and.push({
      OR: [
        { studentName: { contains: kw, mode: 'insensitive' } },
        { phone: { contains: kw } },
        { wechat: { contains: kw, mode: 'insensitive' } },
        { note: { contains: kw, mode: 'insensitive' } },
        { org: { name: { contains: kw, mode: 'insensitive' } } },
      ],
    });
  }
  return { AND: and };
}

const listInclude = {
  org: { select: { name: true } },
  assignee: { select: { name: true } },
  createdBy: { select: { name: true } },
  _count: { select: { follows: true } },
} satisfies Prisma.LeadInclude;

type LeadRow = Prisma.LeadGetPayload<{ include: typeof listInclude }>;

const iso = (d: Date | null) => d?.toISOString() ?? null;

function toItem(l: LeadRow): LeadListItem {
  return {
    id: l.id,
    studentName: l.studentName,
    phone: l.phone,
    wechat: l.wechat,
    source: l.source,
    productTags: l.productTags,
    grade: l.grade,
    degree: l.degree,
    regions: l.regions,
    wechatStatus: l.wechatStatus,
    intention: l.intention,
    pushStatus: l.pushStatus,
    orgId: l.orgId,
    orgName: l.org?.name ?? null,
    pushedAt: iso(l.pushedAt),
    assigneeId: l.assigneeId,
    assigneeName: l.assignee?.name ?? null,
    assignedAt: iso(l.assignedAt),
    createdById: l.createdById,
    createdByName: l.createdBy.name,
    dealId: l.dealId,
    note: l.note,
    lastFollowAt: iso(l.lastFollowAt),
    followCount: l._count.follows,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

/* ============ 列表 / 统计 / 导出 ============ */

export async function listLeads(
  q: Required<Pick<LeadListQuery, 'page' | 'pageSize'>> & LeadListQuery,
  scope: LeadScope,
): Promise<PageResult<LeadListItem>> {
  const where = buildWhere(q, scope);
  const orderBy: Prisma.LeadOrderByWithRelationInput[] = [
    q.sort === 'assignedAt'
      ? { assignedAt: { sort: q.order ?? 'desc', nulls: 'last' } }
      : { [q.sort ?? 'createdAt']: q.order ?? 'desc' },
    { id: 'desc' },
  ];
  const [total, rows] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: listInclude,
    }),
  ]);
  return { total, page: q.page, pageSize: q.pageSize, list: rows.map(toItem) };
}

/** 当前其它筛选条件下，各推出状态的数量 */
export async function leadStatusCounts(q: LeadListQuery, scope: LeadScope): Promise<LeadStatusCounts> {
  const groups = await prisma.lead.groupBy({
    by: ['pushStatus'],
    where: buildWhere(q, scope, false),
    _count: { _all: true },
  });
  const out: LeadStatusCounts = { total: 0 };
  for (const s of LEAD_PUSH_STATUS) out[s] = 0;
  for (const g of groups) {
    out[g.pushStatus] = g._count._all;
    out.total += g._count._all;
  }
  return out;
}

export async function exportLeads(q: LeadListQuery, scope: LeadScope) {
  const rows = await prisma.lead.findMany({
    where: buildWhere(q, scope),
    orderBy: { createdAt: 'desc' },
    take: 5000,
    include: listInclude,
  });
  return rows.map(toItem);
}

/** 筛选面板里的「跟进人 / 创建人 / 跟进机构」选项 */
export async function leadFilterOptions(scope: LeadScope) {
  const where = scopeWhere(scope);
  const [assignees, creators, orgs] = await Promise.all([
    prisma.lead.findMany({ where: { ...where, assigneeId: { not: null } }, distinct: ['assigneeId'], select: { assignee: { select: { id: true, name: true } } } }),
    prisma.lead.findMany({ where, distinct: ['createdById'], select: { createdBy: { select: { id: true, name: true } } } }),
    prisma.lead.findMany({ where: { ...where, orgId: { not: null } }, distinct: ['orgId'], select: { org: { select: { id: true, name: true } } } }),
  ]);
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'zh-CN');
  return {
    assignees: assignees.map((r) => r.assignee!).filter(Boolean).sort(byName),
    creators: creators.map((r) => r.createdBy).sort(byName),
    orgs: orgs.map((r) => r.org!).filter(Boolean).sort(byName),
  };
}

/* ============ 详情 ============ */

async function findInScope(id: string, scope: LeadScope) {
  const lead = await prisma.lead.findFirst({ where: { AND: [{ id }, scopeWhere(scope)] }, include: listInclude });
  if (!lead) throw new AppError(404, '线索不存在或无权查看');
  return lead;
}

export async function getLead(id: string, scope: LeadScope): Promise<LeadDetail> {
  const lead = await findInScope(id, scope);
  const follows = await prisma.leadFollow.findMany({
    where: { leadId: id },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } },
  });
  return {
    ...toItem(lead),
    follows: follows.map((f) => ({
      id: f.id,
      method: f.method,
      content: f.content,
      userName: f.user.name,
      createdAt: f.createdAt.toISOString(),
    })),
  };
}

/* ============ 新增 / 修改 / 删除 ============ */

async function checkOrg(orgId: string | null | undefined) {
  if (!orgId) return;
  const org = await prisma.org.findFirst({ where: { id: orgId, deletedAt: null }, select: { id: true } });
  if (!org) throw new AppError(404, '机构不存在');
}

async function checkAssignee(userId: string | null | undefined) {
  if (!userId) return;
  const u = await prisma.user.findFirst({ where: { id: userId, role: { in: ['ADMIN', 'STAFF'] }, isActive: true } });
  if (!u) throw new AppError(404, '跟进人不存在');
}

function dataOf(input: Partial<LeadInput>): Prisma.LeadUncheckedUpdateInput {
  const d: Prisma.LeadUncheckedUpdateInput = {};
  const keys = [
    'studentName', 'phone', 'wechat', 'source', 'productTags', 'grade', 'degree',
    'regions', 'wechatStatus', 'intention', 'pushStatus', 'orgId', 'note',
  ] as const;
  for (const k of keys) if (input[k] !== undefined) (d as Record<string, unknown>)[k] = input[k];
  return d;
}

export async function createLead(input: LeadInput, userId: string, canAssign: boolean) {
  if (input.pushStatus === '已签约') throw new AppError(400, '「已签约」请在线索详情里点「登记签约」');
  await checkOrg(input.orgId);
  // 员工录入的线索默认自己跟进；只有管理员能指定别人
  const assigneeId = canAssign ? (input.assigneeId ?? null) : userId;
  await checkAssignee(assigneeId);
  const now = new Date();
  const pushStatus = input.pushStatus ?? (input.orgId ? '已推出' : '未推出');
  return prisma.lead.create({
    data: {
      ...(dataOf(input) as Prisma.LeadUncheckedCreateInput),
      studentName: input.studentName,
      productTags: input.productTags ?? [],
      regions: input.regions ?? [],
      pushStatus,
      pushedAt: input.orgId ? now : null,
      assigneeId,
      assignedAt: assigneeId ? now : null,
      createdById: userId,
    },
  });
}

export async function updateLead(id: string, input: Partial<LeadInput>, scope: LeadScope, canAssign: boolean) {
  const lead = await findInScope(id, scope);
  if (lead.dealId) {
    // 已签约的线索：机构和推出状态跟成交记录绑定，不能再改
    if (input.orgId !== undefined && input.orgId !== lead.orgId) throw new AppError(400, '已签约的线索不能更换机构');
    if (input.pushStatus !== undefined && input.pushStatus !== lead.pushStatus) throw new AppError(400, '已签约的线索不能修改推出状态');
  } else if (input.pushStatus === '已签约') {
    throw new AppError(400, '「已签约」请在线索详情里点「登记签约」');
  }
  if (input.orgId !== undefined) await checkOrg(input.orgId);
  const data = dataOf(input);
  // 换了推送机构就记一下推送时间
  if (input.orgId !== undefined && input.orgId !== lead.orgId) {
    data.pushedAt = input.orgId ? new Date() : null;
    if (input.orgId && input.pushStatus === undefined && lead.pushStatus === '未推出') data.pushStatus = '已推出';
  }
  if (input.assigneeId !== undefined && input.assigneeId !== lead.assigneeId) {
    if (!canAssign) throw new AppError(403, '只有管理员可以分配跟进人');
    await checkAssignee(input.assigneeId);
    data.assigneeId = input.assigneeId;
    data.assignedAt = input.assigneeId ? new Date() : null;
  }
  const after = await prisma.lead.update({ where: { id }, data });
  return { before: lead, after };
}

/** 批量分配跟进人（仅管理员） */
export async function assignLeads(ids: string[], assigneeId: string | null) {
  await checkAssignee(assigneeId);
  const r = await prisma.lead.updateMany({
    where: { id: { in: ids } },
    data: { assigneeId, assignedAt: assigneeId ? new Date() : null },
  });
  return { updated: r.count };
}

export async function deleteLead(id: string) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new AppError(404, '线索不存在');
  await prisma.lead.delete({ where: { id } });
  return lead;
}

/* ============ 跟进记录 ============ */

export async function addFollow(id: string, method: string, content: string, userId: string, scope: LeadScope) {
  await findInScope(id, scope);
  const now = new Date();
  const [f] = await prisma.$transaction([
    prisma.leadFollow.create({ data: { leadId: id, userId, method, content, createdAt: now } }),
    prisma.lead.update({ where: { id }, data: { lastFollowAt: now } }),
  ]);
  return f;
}

/* ============ 登记签约 → 生成待到账成交 ============ */

export async function signLead(id: string, input: LeadSignInput, userId: string, scope: LeadScope) {
  const lead = await findInScope(id, scope);
  if (lead.dealId) throw new AppError(400, '这条线索已经登记过签约');
  const deal = await createDeal({
    orgId: input.orgId,
    productId: input.productId ?? null,
    studentName: lead.studentName,
    studentPhone: lead.phone,
    dealAt: input.dealAt,
    amount: input.amount,
    rate: input.rate,
    commission: input.commission,
    note: input.note ?? null,
    createdById: userId,
    // 员工按合作约定比例计算佣金；管理员可以自定
    enforceAgreedRate: !!scope.userId,
  });
  const now = new Date();
  // 只认领还没签约的线索：两个人同时点「登记签约」时，后到的那笔成交撤回
  const claimed = await prisma.lead.updateMany({
    where: { id, dealId: null },
    data: {
      dealId: deal.id,
      pushStatus: '已签约',
      intention: '已签约',
      orgId: input.orgId,
      pushedAt: lead.orgId === input.orgId ? lead.pushedAt : now,
    },
  });
  if (!claimed.count) {
    await prisma.deal.delete({ where: { id: deal.id } });
    throw new AppError(400, '这条线索已经登记过签约');
  }
  return deal;
}
