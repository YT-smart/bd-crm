import { Prisma } from '@prisma/client';
import { NOTIFICATION_CATEGORY_PERM, PERM, ROLE_PERMS, type ChangeLine, type NotificationCategory, type NotificationItem, type NotificationUnread, type Role } from '@bdcrm/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import type { AuthUser } from '../middlewares/auth';
import type { AuditInput } from './audit.service';

/**
 * 消息提醒（事件通知中心）。
 * 业务操作都会写操作日志（writeAudit），这里从日志事件里挑出需要提醒的，
 * 按分类对应的权限找到接收人，每人写一条；同一来源 30 分钟内还没读的事件合并成一条。
 */

/** 各分类的接收人：拥有对应权限的账号（机构资料：员工 + 管理员；线索、成交：管理员） */
const CATEGORY_PERM = NOTIFICATION_CATEGORY_PERM;

const MERGE_WINDOW_MS = 30 * 60 * 1000;

interface BizEvent {
  category: NotificationCategory;
  type: string;
  actor: { id: string; name: string };
  targetId?: string | null;
  /** 合并键：不传则每次单独一条 */
  groupKey?: string;
  /** 本次事件的明细，合并时累积到 items */
  item?: string | null;
  /** union：去重累积（更新了哪些资料）；append：按顺序累积（录入了哪些线索） */
  merge?: 'union' | 'append';
  /** 具体改了什么（机构资料）；合并时追加 */
  changes?: ChangeLine[];
  /** 根据累积的明细和次数生成标题、内容、跳转 */
  build: (items: string[], count: number) => { title: string; content?: string | null; link?: string | null };
}

async function recipients(category: NotificationCategory, excludeId: string) {
  const perm = CATEGORY_PERM[category];
  const roles = (Object.keys(ROLE_PERMS) as Role[]).filter((r) => ROLE_PERMS[r].includes(perm));
  return prisma.user.findMany({
    where: { role: { in: roles }, isActive: true, id: { not: excludeId } },
    select: { id: true, role: true },
  });
}

const MAX_CHANGES = 200;

/** 佣金、收款账户等：没有合作信息权限的人（员工）只看到改了哪项，看不到具体值 */
function changesFor(role: Role, changes: ChangeLine[] | undefined, at: string): ChangeLine[] {
  if (!changes?.length) return [];
  const canSee = ROLE_PERMS[role].includes(PERM.ORG_COOPERATION);
  return changes.map(({ sensitive, ...c }) =>
    sensitive && !canSee ? { label: c.label, hidden: true, at } : { ...c, at },
  );
}
const asChanges = (v: Prisma.JsonValue): ChangeLine[] => (Array.isArray(v) ? (v as unknown as ChangeLine[]) : []);
const toJson = (v: ChangeLine[]) => v as unknown as Prisma.InputJsonValue;

export async function publish(evt: BizEvent) {
  const users = await recipients(evt.category, evt.actor.id);
  const since = new Date(Date.now() - MERGE_WINDOW_MS);
  const at = new Date().toISOString();
  for (const { id: userId, role } of users) {
    const changes = changesFor(role, evt.changes, at);
    if (evt.groupKey) {
      const prev = await prisma.notification.findFirst({
        where: { userId, groupKey: evt.groupKey, readAt: null, updatedAt: { gte: since } },
        orderBy: { updatedAt: 'desc' },
      });
      if (prev) {
        let items = prev.items;
        if (evt.item) items = evt.merge === 'union' ? [...new Set([...items, evt.item])] : [...items, evt.item];
        const count = prev.count + 1;
        const built = evt.build(items, count);
        await prisma.notification.update({
          where: { id: prev.id },
          data: {
            items,
            count,
            changes: toJson([...asChanges(prev.changes), ...changes].slice(-MAX_CHANGES)),
            title: built.title,
            content: built.content ?? null,
            link: built.link ?? null,
            targetId: evt.targetId ?? prev.targetId,
          },
        });
        continue;
      }
    }
    const items = evt.item ? [evt.item] : [];
    const built = evt.build(items, 1);
    await prisma.notification.create({
      data: {
        userId,
        category: evt.category,
        type: evt.type,
        title: built.title,
        content: built.content ?? null,
        link: built.link ?? null,
        targetId: evt.targetId ?? null,
        groupKey: evt.groupKey ?? null,
        items,
        changes: toJson(changes),
        actorId: evt.actor.id,
        actorName: evt.actor.name,
      },
    });
  }
}

/* ============ 从操作日志事件生成提醒 ============ */

/** 机构账号的哪些操作算「更新资料」，以及更新的是哪部分 */
function orgPart(a: AuditInput): string | null {
  if (a.action === 'update') return a.targetName?.includes('公众号二维码') ? '公众号二维码' : '基本信息';
  if (/Contact$/.test(a.action)) return '联系人';
  if (/Product$/.test(a.action)) return '产品';
  if (a.action === 'uploadAttachment' || a.action === 'deleteAttachment') return '附件';
  return null;
}

const yuan = (v: unknown) => `¥${Number(v ?? 0).toLocaleString('zh-CN')}`;
const tailNames = (items: string[], n = 5) => {
  const shown = items.slice(-n).join('、');
  return items.length > n ? `${shown} 等` : shown;
};

async function dealBrief(dealId: string) {
  const d = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { studentName: true, amount: true, customProduct: true, org: { select: { name: true } }, product: { select: { name: true } } },
  });
  if (!d) return null;
  const product = d.product?.name ?? d.customProduct;
  return {
    studentName: d.studentName,
    content: [d.org.name, d.studentName, product, yuan(d.amount)].filter(Boolean).join(' · '),
  };
}

export async function notifyFromAudit(user: AuthUser | undefined, a: AuditInput) {
  if (!user) return;
  const actor = { id: user.id, name: user.name };
  const who = user.role === 'ORG' ? `${user.name}（机构）` : user.name;

  // 机构更新资料：只提醒机构账号自己改的；同一机构 30 分钟内的修改合并
  if (a.module === 'org' && user.role === 'ORG' && user.orgId) {
    const part = orgPart(a);
    if (!part) return;
    // 提交了但实际没改任何内容（比如原样保存），不提醒
    if (a.changes && !a.changes.length) return;
    const orgId = user.orgId;
    const org = await prisma.org.findUnique({ where: { id: orgId }, select: { name: true } });
    return publish({
      category: 'ORG',
      type: 'org.update',
      actor,
      targetId: orgId,
      groupKey: `org:${orgId}`,
      item: part,
      merge: 'union',
      changes: a.changes,
      build: (items) => ({ title: `${org?.name ?? '机构'} 更新了资料`, content: `更新了${items.join('、')}`, link: `/orgs/${orgId}` }),
    });
  }

  // 员工录入线索：同一员工 30 分钟内录入的合并
  if (a.module === 'lead' && a.action === 'create' && user.role !== 'ORG') {
    const leadId = a.targetId;
    return publish({
      category: 'LEAD',
      type: 'lead.create',
      actor,
      targetId: leadId,
      groupKey: `lead:${user.id}`,
      item: a.targetName ?? '',
      merge: 'append',
      build: (items, count) =>
        count === 1
          ? { title: `${who} 录入了新线索`, content: items[0] || null, link: leadId ? `/leads?lead=${leadId}` : '/leads' }
          : { title: `${who} 录入了 ${count} 条线索`, content: tailNames(items), link: '/leads' },
    });
  }

  // 成交：录入、签约、修改、删除
  const dealEvent =
    a.module === 'deal' && ['create', 'update', 'delete'].includes(a.action) ? `deal.${a.action}`
      : a.module === 'lead' && a.action === 'sign' ? 'deal.sign'
        : null;
  if (!dealEvent) return;

  if (dealEvent === 'deal.delete') {
    const b = (a.before ?? {}) as Record<string, unknown>;
    return publish({
      category: 'DEAL',
      type: dealEvent,
      actor,
      targetId: a.targetId,
      build: () => ({
        title: `${who} 删除了成交`,
        content: [b['机构'], a.targetName, yuan(b['成交额'])].filter(Boolean).join(' · '),
        link: '/deals',
      }),
    });
  }

  const dealId = dealEvent === 'deal.sign' ? ((a.after ?? {}) as { dealId?: string }).dealId : a.targetId;
  if (!dealId) return;
  const brief = await dealBrief(dealId);
  if (!brief) return;
  const link = `/deals?keyword=${encodeURIComponent(brief.studentName)}`;
  const verb = { 'deal.create': '录入了成交', 'deal.sign': '签约了线索，生成成交', 'deal.update': '修改了成交' }[dealEvent];
  return publish({
    category: 'DEAL',
    type: dealEvent,
    actor,
    targetId: dealId,
    // 同一笔成交连续修改只提醒一条
    groupKey: dealEvent === 'deal.update' ? `deal-update:${dealId}` : undefined,
    build: (_items, count) => ({
      title: `${who} ${verb}${count > 1 ? `（${count} 次）` : ''}`,
      content: brief.content,
      link,
    }),
  });
}

/* ============ 查询 / 已读 ============ */

const CATEGORIES: NotificationCategory[] = ['ORG', 'LEAD', 'DEAL'];

export async function unreadCount(userId: string): Promise<NotificationUnread> {
  const rows = await prisma.notification.groupBy({ by: ['category'], where: { userId, readAt: null }, _count: true });
  const r = { ALL: 0, ORG: 0, LEAD: 0, DEAL: 0 } as NotificationUnread;
  for (const x of rows) {
    r[x.category] = x._count;
    r.ALL += x._count;
  }
  return r;
}

export async function listNotifications(
  userId: string,
  q: { category?: NotificationCategory; unreadOnly?: boolean; page: number; pageSize: number },
) {
  const where = {
    userId,
    ...(q.category ? { category: q.category } : {}),
    ...(q.unreadOnly ? { readAt: null } : {}),
  };
  const [total, rows, unread] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    unreadCount(userId),
  ]);
  const list: NotificationItem[] = rows.map((n) => ({
    id: n.id,
    category: n.category,
    type: n.type,
    title: n.title,
    content: n.content,
    link: n.link,
    count: n.count,
    changes: asChanges(n.changes),
    actorName: n.actorName,
    read: !!n.readAt,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  }));
  return { list, total, unread };
}

export async function markRead(userId: string, id: string) {
  const r = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  if (!r.count) {
    const exists = await prisma.notification.count({ where: { id, userId } });
    if (!exists) throw new AppError(404, '消息不存在');
  }
}

export async function markAllRead(userId: string, category?: NotificationCategory) {
  const r = await prisma.notification.updateMany({
    where: { userId, readAt: null, ...(category && CATEGORIES.includes(category) ? { category } : {}) },
    data: { readAt: new Date() },
  });
  return r.count;
}

/** 清理 90 天前已读的消息，避免表无限增长 */
export async function pruneOldNotifications() {
  await prisma.notification.deleteMany({
    where: { readAt: { lt: new Date(Date.now() - 90 * 24 * 3600 * 1000) } },
  });
}
