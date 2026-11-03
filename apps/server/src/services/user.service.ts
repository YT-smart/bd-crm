import type { Prisma } from '@prisma/client';
import type { Role, PageResult } from '@bdcrm/shared';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/http';
import { hashPassword } from '../lib/security';

export interface UserListItem {
  id: string;
  username: string;
  name: string;
  role: Role;
  orgId: string | null;
  orgName: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  mustChangePwd: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserListQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  role?: Role;
  isActive?: boolean;
}

export async function listUsers(q: UserListQuery): Promise<PageResult<UserListItem>> {
  const where: Prisma.UserWhereInput = {};
  if (q.keyword) {
    const kw = q.keyword.trim();
    where.OR = [
      { name: { contains: kw, mode: 'insensitive' } },
      { username: { contains: kw, mode: 'insensitive' } },
      { phone: { contains: kw } },
    ];
  }
  if (q.role) where.role = q.role;
  if (q.isActive !== undefined) where.isActive = q.isActive;

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: { org: { select: { name: true } } },
    }),
  ]);

  return {
    total,
    page: q.page,
    pageSize: q.pageSize,
    list: rows.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      orgId: u.orgId,
      orgName: u.org?.name ?? null,
      phone: u.phone,
      email: u.email,
      isActive: u.isActive,
      mustChangePwd: u.mustChangePwd,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

interface CreateUserInput {
  username: string;
  name: string;
  role: Role;
  orgId?: string | null;
  phone?: string | null;
  email?: string | null;
  password: string;
}

export async function createUser(input: CreateUserInput) {
  const existing = await prisma.user.findUnique({ where: { username: input.username } });
  if (existing) throw new AppError(409, `用户名"${input.username}"已存在`);

  if (input.role === 'ORG' && input.orgId) {
    const org = await prisma.org.findFirst({ where: { id: input.orgId, deletedAt: null } });
    if (!org) throw new AppError(404, '绑定的机构不存在');
  }

  const user = await prisma.user.create({
    data: {
      username: input.username,
      name: input.name,
      role: input.role,
      orgId: input.role === 'ORG' ? (input.orgId ?? null) : null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      passwordHash: await hashPassword(input.password),
      mustChangePwd: true,
    },
  });
  return { id: user.id, username: user.username, name: user.name };
}

interface UpdateUserInput {
  name?: string;
  role?: Role;
  orgId?: string | null;
  phone?: string | null;
  email?: string | null;
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, '账号不存在');

  if (input.role === 'ORG' && input.orgId) {
    const org = await prisma.org.findFirst({ where: { id: input.orgId, deletedAt: null } });
    if (!org) throw new AppError(404, '绑定的机构不存在');
  }
  if (input.role === 'ORG' && !input.orgId && !user.orgId) {
    throw new AppError(400, '机构账号必须绑定机构');
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      role: input.role,
      orgId: input.role === 'ORG' ? (input.orgId ?? user.orgId) : (input.role ? null : undefined),
      phone: input.phone,
      email: input.email,
    },
  });
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, '账号不存在');
  return prisma.user.update({ where: { id: userId }, data: { isActive } });
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, '账号不存在');
  return prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePwd: true,
      failedAttempts: 0,
      lockedUntil: null,
    },
  });
}

export async function deleteUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, '账号不存在');
  if (user.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN', isActive: true } });
    if (adminCount <= 1) throw new AppError(400, '至少保留一个管理员账号');
  }
  const used = await Promise.all([
    prisma.deal.count({ where: { OR: [{ createdById: userId }, { auditedById: userId }, { settledById: userId }] } }),
    prisma.followUp.count({ where: { userId } }),
  ]);
  if (used[0] + used[1] > 0) {
    throw new AppError(409, '该账号已有成交或跟进记录，为保留历史请改为停用');
  }
  await prisma.user.delete({ where: { id: userId } });
}
