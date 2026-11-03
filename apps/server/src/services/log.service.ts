import type { Prisma } from '@prisma/client';
import type { PageResult } from '@bdcrm/shared';
import { prisma } from '../lib/prisma';
import { dayRange } from '../lib/date';

export interface AuditLogItem {
  id: string;
  userId: string | null;
  userName: string;
  role: string | null;
  module: string;
  action: string;
  targetId: string | null;
  targetName: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogQuery {
  page: number;
  pageSize: number;
  module?: string;
  action?: string;
  userId?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

export async function listAuditLogs(q: AuditLogQuery): Promise<PageResult<AuditLogItem>> {
  const where: Prisma.AuditLogWhereInput = {};
  if (q.module) where.module = q.module;
  if (q.action) where.action = q.action;
  if (q.userId) where.userId = q.userId;
  if (q.keyword) {
    const kw = q.keyword.trim();
    where.OR = [
      { userName: { contains: kw, mode: 'insensitive' } },
      { targetName: { contains: kw, mode: 'insensitive' } },
      { action: { contains: kw, mode: 'insensitive' } },
    ];
  }
  const range = dayRange(q.startDate, q.endDate);
  if (range) where.createdAt = range;

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  return {
    total,
    page: q.page,
    pageSize: q.pageSize,
    list: rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      role: r.role,
      module: r.module,
      action: r.action,
      targetId: r.targetId,
      targetName: r.targetName,
      before: r.before,
      after: r.after,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/** 获取日志中出现过的模块列表 */
export async function listAuditModules(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ['module'],
    select: { module: true },
    orderBy: { module: 'asc' },
  });
  return rows.map((r) => r.module);
}
