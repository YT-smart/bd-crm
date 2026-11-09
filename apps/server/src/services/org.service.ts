import type { Prisma } from '@prisma/client';
import {
  APPROVED_DEAL_STATUSES,
  DealStatus,
  calcCompleteness,
  normalizeCityKeyword,
  PROVINCE_OF_CITY,
  type OrgListItem,
  type OrgListQuery,
  type OrgDetail,
  type OrgStats,
  type OrgContactItem,
  type OrgProductItem,
  type OrgFollowUpItem,
  type OrgReviewItem,
  type OrgAttachmentItem,
  type PageResult,
  type StaffOption,
} from '@bdcrm/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { generatePassword, hashPassword } from '../lib/security';
import { removeStoredFile } from '../lib/storage';

const num = (v: Prisma.Decimal | null | undefined) => (v == null ? 0 : Number(v));
const isoOrNull = (d: Date | null | undefined) => d?.toISOString() ?? null;

/** 列表 / 导出共用的筛选条件 */
function buildOrgWhere(q: OrgListQuery): Prisma.OrgWhereInput {
  const where: Prisma.OrgWhereInput = { deletedAt: null };
  if (q.keyword) {
    const kw = q.keyword.trim();
    where.OR = [
      { name: { contains: kw, mode: 'insensitive' } },
      { city: { contains: kw, mode: 'insensitive' } },
      { province: { contains: kw } },
      // 校区城市：任一校区命中即可（兼容输入「杭州市」）
      { officeCities: { has: normalizeCityKeyword(kw) } },
      { contacts: { some: { OR: [{ name: { contains: kw } }, { phone: { contains: kw } }] } } },
    ];
  }
  if (q.province) where.province = q.province;
  if (q.status) where.status = q.status;
  if (q.level) where.level = q.level;
  if (q.country) where.countries = { has: q.country };
  // 以下条件各自是一组 OR，与关键词的 OR 用 AND 组合
  const and: Prisma.OrgWhereInput[] = [];
  // 业务类型：机构开展的业务，或任一产品属于该类型（与仪表盘地图口径一致）
  if (q.businessType) {
    and.push({ OR: [{ businessTypes: { has: q.businessType } }, { products: { some: { type: q.businessType } } }] });
  }
  // 城市：总部城市或任一校区城市命中
  if (q.city) and.push({ OR: [{ city: q.city }, { officeCities: { has: q.city } }] });
  if (and.length) where.AND = and;
  return where;
}

/** 筛选面板里平铺显示的城市 / 国家：至少这么多家机构填了才出现 */
export const ORG_FACET_MIN = 5;

/**
 * 机构筛选面板的常用项：按录入的机构动态统计。
 * 城市算总部城市 + 校区城市（同一家机构只算一次），国家算覆盖国家。
 */
export async function orgFilterFacets() {
  const orgs = await prisma.org.findMany({
    where: { deletedAt: null },
    select: { city: true, officeCities: true, countries: true },
  });
  const cities = new Map<string, number>();
  const countries = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  for (const o of orgs) {
    for (const c of new Set([o.city, ...o.officeCities].filter((c): c is string => !!c))) bump(cities, c);
    for (const c of new Set(o.countries)) bump(countries, c);
  }
  const top = (m: Map<string, number>) =>
    [...m.entries()]
      .filter(([, n]) => n >= ORG_FACET_MIN)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh'))
      .map(([name, count]) => ({ name, count }));
  return { min: ORG_FACET_MIN, cities: top(cities), countries: top(countries) };
}

/**
 * 机构列表（搜索 + 省份 / 状态 / 等级筛选 + 分页 + 排序）。
 */
export async function listOrgs(q: Required<Pick<OrgListQuery, 'page' | 'pageSize'>> & OrgListQuery): Promise<PageResult<OrgListItem>> {
  const where = buildOrgWhere(q);

  // 默认按成交率从高到低
  const sort = q.sort ?? 'dealRate';
  const order = q.order ?? 'desc';
  const skip = (q.page - 1) * q.pageSize;
  const include = { owner: { select: { name: true } } } as const;

  let total: number;
  let rows: Prisma.OrgGetPayload<{ include: typeof include }>[];

  if (sort === 'dealCount' || sort === 'dealRate') {
    // 成交笔数 / 成交率为成交记录的聚合值：先取全部匹配机构的统计，内存排序后再分页
    const all = await prisma.org.findMany({ where, select: { id: true, createdAt: true } });
    total = all.length;
    const sm = await dealCountsOf(all.map((o) => o.id));
    const value = (id: string) => {
      const s = sm.get(id);
      if (sort === 'dealCount') return s?.approved ?? 0;
      return s?.reports ? s.approved / s.reports : null;
    };
    const dir = order === 'asc' ? 1 : -1;
    const pageIds = all
      .sort((a, b) => {
        const va = value(a.id);
        const vb = value(b.id);
        // 没有报单的机构（成交率为空）始终排在最后
        if (va === null || vb === null) {
          if (va !== vb) return va === null ? 1 : -1;
        } else if (va !== vb) {
          return dir * (va - vb);
        }
        return (sm.get(b.id)?.approved ?? 0) - (sm.get(a.id)?.approved ?? 0) || b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(skip, skip + q.pageSize)
      .map((o) => o.id);
    const found = await prisma.org.findMany({ where: { id: { in: pageIds } }, include });
    const fm = new Map(found.map((o) => [o.id, o]));
    rows = pageIds.map((id) => fm.get(id)).filter((o): o is NonNullable<typeof o> => !!o);
  } else {
    const orderBy: Prisma.OrgOrderByWithRelationInput[] =
      sort === 'level'
        ? [{ level: { sort: order, nulls: 'last' } }, { createdAt: 'desc' }]
        : [{ [sort]: order }];
    [total, rows] = await Promise.all([
      prisma.org.count({ where }),
      prisma.org.findMany({ where, orderBy, skip, take: q.pageSize, include }),
    ]);
  }

  const ids = rows.map((r) => r.id);
  const [stats, counts] = await Promise.all([
    ids.length
      ? prisma.deal.groupBy({
          by: ['orgId'],
          where: { orgId: { in: ids }, status: { in: [...APPROVED_DEAL_STATUSES] } },
          _sum: { amount: true, commission: true },
          _max: { dealAt: true },
        })
      : [],
    dealCountsOf(ids),
  ]);
  const sm = new Map(stats.map((s) => [s.orgId, s]));

  return {
    total,
    page: q.page,
    pageSize: q.pageSize,
    list: rows.map((o) => {
      const s = sm.get(o.id);
      const c = counts.get(o.id);
      return {
        id: o.id,
        name: o.name,
        province: o.province,
        city: o.city,
        officeCities: o.officeCities,
        countries: o.countries,
        status: o.status,
        level: o.level,
        defaultRate: num(o.defaultRate),
        businessTypes: o.businessTypes,
        tags: o.tags,
        completeness: o.completeness,
        ownerName: o.owner?.name ?? null,
        dealCount: c?.approved ?? 0,
        reportCount: c?.reports ?? 0,
        dealRate: c?.reports ? Math.round((c.approved / c.reports) * 1000) / 10 : null,
        dealAmount: num(s?._sum.amount),
        commission: num(s?._sum.commission),
        lastDealAt: s?._max.dealAt?.toISOString() ?? null,
        createdAt: o.createdAt.toISOString(),
      };
    }),
  };
}

/** 各机构的报单总数与已核实成交数（成交率 = approved / reports） */
async function dealCountsOf(orgIds: string[]) {
  const m = new Map<string, { reports: number; approved: number }>();
  if (!orgIds.length) return m;
  const groups = await prisma.deal.groupBy({
    by: ['orgId', 'status'],
    where: { orgId: { in: orgIds } },
    _count: { _all: true },
  });
  for (const g of groups) {
    const cur = m.get(g.orgId) ?? { reports: 0, approved: 0 };
    cur.reports += g._count._all;
    if (APPROVED_DEAL_STATUSES.includes(g.status)) cur.approved += g._count._all;
    m.set(g.orgId, cur);
  }
  return m;
}

/* ---------- 机构详情 ---------- */

export async function getOrgDetail(orgId: string): Promise<OrgDetail> {
  const org = await prisma.org.findFirst({
    where: { id: orgId, deletedAt: null },
    include: {
      owner: { select: { name: true } },
      contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
      // 推荐级别高（数字小）的产品排前面，未设置级别的排最后
      products: { orderBy: [{ level: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }] },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });
  if (!org) throw new AppError(404, '机构不存在');

  // 统计数据
  const dealAgg = await prisma.deal.groupBy({
    by: ['status'],
    where: { orgId },
    _count: { _all: true },
    _sum: { amount: true, commission: true },
  });
  const stats: OrgStats = {
    dealCount: 0,
    dealAmount: 0,
    commission: 0,
    settled: 0,
    unsettled: 0,
    pendingAudit: 0,
  };
  for (const g of dealAgg) {
    const cnt = g._count._all;
    const amt = num(g._sum.amount);
    const com = num(g._sum.commission);
    if (g.status === DealStatus.SETTLED) {
      stats.settled += com;
      stats.dealCount += cnt;
      stats.dealAmount += amt;
      stats.commission += com;
    } else if (g.status === DealStatus.PENDING_PAYMENT) {
      stats.unsettled += com;
      stats.dealCount += cnt;
      stats.dealAmount += amt;
      stats.commission += com;
    } else if (g.status === DealStatus.PENDING_AUDIT) {
      stats.pendingAudit += cnt;
    }
  }

  const completenessResult = calcCompleteness(org);

  const contacts: OrgContactItem[] = org.contacts.map((c) => ({
    id: c.id,
    name: c.name,
    title: c.title,
    phone: c.phone,
    wechat: c.wechat,
    email: c.email,
    isPrimary: c.isPrimary,
  }));

  const products: OrgProductItem[] = org.products.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    priceMin: num(p.priceMin) || null,
    priceMax: num(p.priceMax) || null,
    rate: p.rate != null ? num(p.rate) : null,
    level: p.level,
    note: p.note,
  }));

  return {
    id: org.id,
    name: org.name,
    logo: org.logo,
    advantage: org.advantage,
    intro: org.intro,
    province: org.province,
    city: org.city,
    address: org.address,
    website: org.website,
    wechat: org.wechat,
    hasWechatQr: !!org.wechatQr,
    foundedAt: isoOrNull(org.foundedAt),
    scale: org.scale,
    businessTypes: org.businessTypes,
    countries: org.countries,
    officeCities: org.officeCities,
    tags: org.tags,
    level: org.level,
    status: org.status,
    defaultRate: num(org.defaultRate),
    settleCycle: org.settleCycle,
    bankInfo: org.bankInfo as OrgDetail['bankInfo'],
    contractStart: isoOrNull(org.contractStart),
    contractEnd: isoOrNull(org.contractEnd),
    ownerId: org.ownerId,
    ownerName: org.owner?.name ?? null,
    completeness: completenessResult.percentage,
    missing: completenessResult.missing,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
    contacts,
    products,
    stats,
  };
}

/* ---------- 新增机构 ---------- */

interface CreateOrgInput {
  name: string;
  province?: string | null;
  city?: string | null;
  defaultRate: number;
  ownerId?: string | null;
  createAccount?: boolean;
  accountUsername?: string;
  accountName?: string;
  accountPassword?: string;
}

export async function createOrg(input: CreateOrgInput) {
  const existing = await prisma.org.findFirst({ where: { name: input.name, deletedAt: null } });
  if (existing) throw new AppError(409, `机构"${input.name}"已存在`);
  if (input.city && input.province && PROVINCE_OF_CITY[input.city] !== input.province) {
    throw new AppError(400, `总部城市「${input.city}」不属于${input.province}`);
  }

  let plainPassword: string | null = null;
  if (input.createAccount) {
    if (!input.accountUsername) throw new AppError(400, '请填写登录账号');
    const dupUser = await prisma.user.findUnique({ where: { username: input.accountUsername } });
    if (dupUser) throw new AppError(409, `登录账号"${input.accountUsername}"已被占用`);
    plainPassword = input.accountPassword || generatePassword();
  }

  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.org.create({
      data: {
        name: input.name,
        province: input.province ?? null,
        city: input.city ?? null,
        officeCities: input.city ? [input.city] : [],
        defaultRate: input.defaultRate,
        ownerId: input.ownerId ?? null,
        completeness: 0,
      },
    });
    const { percentage } = calcCompleteness(org);
    await tx.org.update({ where: { id: org.id }, data: { completeness: percentage } });

    let account: { username: string; name: string; password: string } | null = null;
    if (input.createAccount && plainPassword) {
      const user = await tx.user.create({
        data: {
          username: input.accountUsername!,
          name: (input.accountName || input.name).slice(0, 20),
          role: 'ORG',
          orgId: org.id,
          passwordHash: await hashPassword(plainPassword),
          mustChangePwd: true,
        },
      });
      account = { username: user.username, name: user.name, password: plainPassword };
    }
    return { id: org.id, name: org.name, account };
  });

  return result;
}

/* ---------- 更新机构 ---------- */

export async function updateOrg(orgId: string, input: Partial<Prisma.OrgUncheckedUpdateInput & { tags: string[]; businessTypes: string[]; countries: string[]; officeCities: string[] }>) {
  const org = await prisma.org.findFirst({ where: { id: orgId, deletedAt: null } });
  if (!org) throw new AppError(404, '机构不存在');

  // 名称去重
  if (input.name && input.name !== org.name) {
    const dup = await prisma.org.findFirst({ where: { name: input.name as string, deletedAt: null, id: { not: orgId } } });
    if (dup) throw new AppError(409, `机构"${input.name}"已存在`);
  }

  // 省市一致性校验 + 总部城市自动并入校区城市
  const province = (input.province !== undefined ? input.province : org.province) as string | null;
  const city = (input.city !== undefined ? input.city : org.city) as string | null;
  if (city && province && PROVINCE_OF_CITY[city] !== province) {
    throw new AppError(400, `总部城市「${city}」不属于${province}`);
  }
  if (input.city !== undefined || input.officeCities !== undefined) {
    const offices = input.officeCities ?? org.officeCities;
    input.officeCities = city && !offices.includes(city) ? [city, ...offices] : offices;
  }

  const updated = await prisma.org.update({ where: { id: orgId }, data: input });

  // 重新计算完整度（需带上联系人 / 产品数量）
  await refreshCompleteness(orgId);

  return updated;
}

/* ---------- 删除机构（软删除） ---------- */

export async function deleteOrg(orgId: string) {
  const org = await prisma.org.findFirst({ where: { id: orgId, deletedAt: null } });
  if (!org) throw new AppError(404, '机构不存在');

  await prisma.org.update({ where: { id: orgId }, data: { deletedAt: new Date() } });
  // 同时停用该机构所有子账号
  await prisma.user.updateMany({ where: { orgId, role: 'ORG' }, data: { isActive: false } });
}

/* ---------- 联系人 CRUD ---------- */

export async function addContact(orgId: string, input: { name: string; title?: string | null; phone?: string | null; wechat?: string | null; email?: string | null; isPrimary?: boolean }) {
  await ensureOrg(orgId);
  if (input.isPrimary) {
    await prisma.orgContact.updateMany({ where: { orgId }, data: { isPrimary: false } });
  }
  const contact = await prisma.orgContact.create({
    data: { orgId, name: input.name, title: input.title ?? null, phone: input.phone ?? null, wechat: input.wechat ?? null, email: input.email ?? null, isPrimary: input.isPrimary ?? false },
  });
  await refreshCompleteness(orgId);
  return contact;
}

export async function updateContact(orgId: string, contactId: string, input: { name?: string; title?: string | null; phone?: string | null; wechat?: string | null; email?: string | null; isPrimary?: boolean }) {
  const contact = await prisma.orgContact.findFirst({ where: { id: contactId, orgId } });
  if (!contact) throw new AppError(404, '联系人不存在');
  if (input.isPrimary) {
    await prisma.orgContact.updateMany({ where: { orgId: contact.orgId, id: { not: contactId } }, data: { isPrimary: false } });
  }
  return prisma.orgContact.update({ where: { id: contactId }, data: input });
}

export async function deleteContact(orgId: string, contactId: string) {
  const contact = await prisma.orgContact.findFirst({ where: { id: contactId, orgId } });
  if (!contact) throw new AppError(404, '联系人不存在');
  await prisma.orgContact.delete({ where: { id: contactId } });
  await refreshCompleteness(contact.orgId);
}

/* ---------- 产品 CRUD ---------- */

export async function addProduct(orgId: string, input: { name: string; type: string; priceMin?: number | null; priceMax?: number | null; rate?: number | null; level?: number | null; note?: string | null }) {
  await ensureOrg(orgId);
  const product = await prisma.orgProduct.create({
    data: { orgId, name: input.name, type: input.type, priceMin: input.priceMin ?? null, priceMax: input.priceMax ?? null, rate: input.rate ?? null, level: input.level ?? null, note: input.note ?? null },
  });
  await refreshCompleteness(orgId);
  return product;
}

export async function updateProduct(orgId: string, productId: string, input: { name?: string; type?: string; priceMin?: number | null; priceMax?: number | null; rate?: number | null; level?: number | null; note?: string | null }) {
  const product = await prisma.orgProduct.findFirst({ where: { id: productId, orgId } });
  if (!product) throw new AppError(404, '产品不存在');
  return prisma.orgProduct.update({ where: { id: productId }, data: input });
}

export async function deleteProduct(orgId: string, productId: string) {
  const product = await prisma.orgProduct.findFirst({ where: { id: productId, orgId } });
  if (!product) throw new AppError(404, '产品不存在');
  await prisma.orgProduct.delete({ where: { id: productId } });
  await refreshCompleteness(orgId);
}

/* ---------- 跟进记录 ---------- */

export async function listFollowUps(orgId: string): Promise<OrgFollowUpItem[]> {
  const rows = await prisma.followUp.findMany({
    where: { orgId },
    orderBy: { followAt: 'desc' },
    include: { user: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user.name,
    method: r.method,
    content: r.content,
    followAt: r.followAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function addFollowUp(orgId: string, userId: string, input: { method: string; content: string; followAt: string }) {
  await ensureOrg(orgId);
  return prisma.followUp.create({
    data: { orgId, userId, method: input.method, content: input.content, followAt: new Date(input.followAt) },
  });
}

export async function deleteFollowUp(followUpId: string, userId: string, isAdmin: boolean) {
  const fu = await prisma.followUp.findUnique({ where: { id: followUpId } });
  if (!fu) throw new AppError(404, '跟进记录不存在');
  if (!isAdmin && fu.userId !== userId) throw new AppError(403, '只能删除自己的跟进记录');
  await prisma.followUp.delete({ where: { id: followUpId } });
}

/* ---------- 机构评价（内部） ---------- */

export async function listReviews(orgId: string): Promise<OrgReviewItem[]> {
  const rows = await prisma.orgReview.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user.name,
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function addReview(orgId: string, userId: string, content: string) {
  await ensureOrg(orgId);
  return prisma.orgReview.create({ data: { orgId, userId, content } });
}

export async function deleteReview(orgId: string, reviewId: string, userId: string, isAdmin: boolean) {
  const r = await prisma.orgReview.findFirst({ where: { id: reviewId, orgId } });
  if (!r) throw new AppError(404, '评价不存在');
  if (!isAdmin && r.userId !== userId) throw new AppError(403, '只能删除自己写的评价');
  await prisma.orgReview.delete({ where: { id: reviewId } });
}

/* ---------- 附件 ---------- */

export async function listAttachments(orgId: string): Promise<OrgAttachmentItem[]> {
  const rows = await prisma.attachment.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    include: { uploadedBy: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    name: r.name,
    url: r.url,
    size: r.size,
    mime: r.mime,
    uploadedById: r.uploadedById,
    uploadedByName: r.uploadedBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createAttachment(
  orgId: string,
  userId: string,
  input: { category: string; name: string; url: string; size: number; mime: string | null },
): Promise<OrgAttachmentItem> {
  await ensureOrg(orgId);
  const r = await prisma.attachment.create({
    data: { orgId, uploadedById: userId, ...input },
    include: { uploadedBy: { select: { name: true } } },
  });
  return {
    id: r.id,
    category: r.category,
    name: r.name,
    url: r.url,
    size: r.size,
    mime: r.mime,
    uploadedById: r.uploadedById,
    uploadedByName: r.uploadedBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function getAttachment(orgId: string, attachmentId: string) {
  const a = await prisma.attachment.findFirst({ where: { id: attachmentId, orgId } });
  if (!a) throw new AppError(404, '附件不存在');
  return a;
}

export async function deleteAttachment(attachmentId: string) {
  const a = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!a) throw new AppError(404, '附件不存在');
  await prisma.attachment.delete({ where: { id: attachmentId } });
  await removeStoredFile(a.url);
}

/* ---------- 公众号二维码 ---------- */

export async function setWechatQr(orgId: string, key: string | null) {
  const org = await ensureOrg(orgId);
  await prisma.org.update({ where: { id: orgId }, data: { wechatQr: key } });
  if (org.wechatQr && org.wechatQr !== key) await removeStoredFile(org.wechatQr);
}

export async function getWechatQrKey(orgId: string) {
  const org = await ensureOrg(orgId);
  if (!org.wechatQr) throw new AppError(404, '尚未上传公众号二维码');
  return org.wechatQr;
}

/* ---------- 员工列表（下拉选择） ---------- */

export async function listStaff(): Promise<StaffOption[]> {
  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'STAFF'] }, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return users;
}

/* ---------- 导出 ---------- */

export async function exportOrgs(q: OrgListQuery) {
  return prisma.org.findMany({
    where: buildOrgWhere(q),
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { name: true } },
      contacts: { where: { isPrimary: true }, take: 1 },
    },
  });
}

/* ---------- 工具函数 ---------- */

async function ensureOrg(orgId: string) {
  const org = await prisma.org.findFirst({ where: { id: orgId, deletedAt: null } });
  if (!org) throw new AppError(404, '机构不存在');
  return org;
}

async function refreshCompleteness(orgId: string) {
  const org = await prisma.org.findUnique({
    where: { id: orgId },
    include: { contacts: { select: { id: true } }, products: { select: { id: true } } },
  });
  if (!org) return;
  const { percentage } = calcCompleteness(org);
  if (percentage !== org.completeness) {
    await prisma.org.update({ where: { id: orgId }, data: { completeness: percentage } });
  }
}
