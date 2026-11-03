import type { User, Org } from '@prisma/client';
import { permsOf, type LoginLogItem, type UserProfile } from '@bdcrm/shared';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { Errors } from '../lib/http';
import { hashPassword, verifyPassword } from '../lib/security';

/** 占位哈希：账号不存在时也做一次同成本的 bcrypt 比对 */
const dummyHashPromise = hashPassword('placeholder-not-a-real-password');

export function toProfile(user: User & { org?: Pick<Org, 'name'> | null }): UserProfile {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    orgId: user.orgId,
    orgName: user.org?.name ?? null,
    phone: user.phone,
    email: user.email,
    avatar: user.avatar,
    mustChangePwd: user.mustChangePwd,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    permissions: permsOf(user.role),
  };
}

interface LoginCtx {
  ip: string | null;
  userAgent: string | null;
}

async function logLogin(username: string, userId: string | null, success: boolean, reason: string | null, ctx: LoginCtx) {
  await prisma.loginLog.create({
    data: { username, userId, success, reason, ip: ctx.ip, userAgent: ctx.userAgent?.slice(0, 255) ?? null },
  });
}

/**
 * 登录：连续 5 次密码错误锁定 15 分钟。
 * 返回用户（含机构名）；调用方负责签发 Cookie。
 */
export async function login(username: string, password: string, ctx: LoginCtx) {
  const user = await prisma.user.findUnique({ where: { username }, include: { org: { select: { name: true } } } });
  if (!user) {
    // 与真实账号走相同耗时的哈希比对，避免通过响应时间探测账号是否存在
    await verifyPassword(password, await dummyHashPromise);
    await logLogin(username, null, false, '账号不存在', ctx);
    throw Errors.unauthorized('账号或密码错误');
  }

  const now = Date.now();
  if (user.lockedUntil && user.lockedUntil.getTime() > now) {
    const mins = Math.ceil((user.lockedUntil.getTime() - now) / 60000);
    await logLogin(username, user.id, false, '账号锁定中', ctx);
    throw Errors.locked(`密码错误次数过多，账号已锁定，请 ${mins} 分钟后再试`);
  }

  const passed = await verifyPassword(password, user.passwordHash);
  if (!passed) {
    const attempts = user.failedAttempts + 1;
    const lock = attempts >= config.loginMaxFailed;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(now + config.loginLockMinutes * 60000) : null,
      },
    });
    await logLogin(username, user.id, false, lock ? '密码错误，已锁定' : '密码错误', ctx);
    if (lock) throw Errors.locked(`密码错误次数过多，账号已锁定 ${config.loginLockMinutes} 分钟`);
    // 与账号不存在时提示一致，不暴露账号是否存在
    throw Errors.unauthorized('账号或密码错误');
  }

  if (!user.isActive) {
    await logLogin(username, user.id, false, '账号已停用', ctx);
    throw Errors.forbidden('账号已停用，请联系管理员');
  }
  if (user.role === 'ORG' && !user.orgId) {
    throw Errors.forbidden('机构账号未绑定机构，请联系管理员');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    include: { org: { select: { name: true } } },
  });
  await logLogin(username, user.id, true, null, ctx);
  return updated;
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { org: { select: { name: true } } } });
  if (!user) throw Errors.unauthorized();
  return toProfile(user);
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Errors.unauthorized();
  if (!(await verifyPassword(oldPassword, user.passwordHash))) throw Errors.badRequest('原密码不正确');
  if (oldPassword === newPassword) throw Errors.badRequest('新密码不能与原密码相同');
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), mustChangePwd: false },
    include: { org: { select: { name: true } } },
  });
  return toProfile(updated);
}

export async function recentLogins(userId: string, take = 10): Promise<LoginLogItem[]> {
  const rows = await prisma.loginLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    ip: r.ip,
    userAgent: r.userAgent,
    success: r.success,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }));
}
