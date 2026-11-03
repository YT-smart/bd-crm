import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export interface AuditInput {
  module: string;
  action: string;
  targetId?: string | null;
  targetName?: string | null;
  before?: unknown;
  after?: unknown;
  /** 未登录场景（如登录失败）手动指定操作人 */
  actor?: { id?: string | null; name: string; role?: 'ADMIN' | 'STAFF' | 'ORG' | null };
}

export function clientIp(req: Request): string | null {
  return (req.ip ?? req.socket.remoteAddress ?? null)?.replace(/^::ffff:/, '') ?? null;
}

const toJson = (v: unknown) =>
  v === undefined || v === null ? Prisma.JsonNull : (JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue);

/** 写操作日志。日志失败不影响主流程。 */
export async function writeAudit(req: Request, input: AuditInput) {
  const actor = input.actor ?? (req.user ? { id: req.user.id, name: req.user.name, role: req.user.role } : null);
  try {
    await prisma.auditLog.create({
      data: {
        userId: actor?.id ?? null,
        userName: actor?.name ?? '匿名',
        role: actor?.role ?? null,
        module: input.module,
        action: input.action,
        targetId: input.targetId ?? null,
        targetName: input.targetName ?? null,
        before: toJson(input.before),
        after: toJson(input.after),
        ip: clientIp(req),
      },
    });
  } catch (e) {
    console.error('[audit] 写入失败', e);
  }
}
