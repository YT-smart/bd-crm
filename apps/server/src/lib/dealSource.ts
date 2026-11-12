import { Prisma } from '@prisma/client';
import type { DealSource } from '@bdcrm/shared';

/** 按录入方区分成交：机构账号录入的，或员工（含管理员）录入的 */
const ROLES: Record<DealSource, string[]> = { ORG: ['ORG'], STAFF: ['STAFF', 'ADMIN'] };

/** Prisma where 条件；不传 source 表示全部 */
export function sourceWhere(source?: DealSource): Prisma.DealWhereInput {
  if (!source) return {};
  return { createdBy: { role: source === 'ORG' ? 'ORG' : { in: ['STAFF', 'ADMIN'] } } };
}

/** 原生 SQL 片段（以 AND 开头），dealAlias 是 Deal 表在查询里的名字 */
export function sourceSql(source: DealSource | undefined, dealAlias = '"Deal"'): Prisma.Sql {
  if (!source) return Prisma.empty;
  const roles = ROLES[source].map((r) => `'${r}'`).join(',');
  return Prisma.raw(
    `AND EXISTS (SELECT 1 FROM "User" su WHERE su.id = ${dealAlias}."createdById" AND su.role::text IN (${roles}))`,
  );
}
