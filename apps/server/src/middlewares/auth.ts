import type { NextFunction, Request, Response } from 'express';
import { permsOf, type Perm, type Role } from '@bdcrm/shared';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { Errors } from '../lib/http';
import { pwdVersion, verifyToken } from '../lib/security';

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  orgId: string | null;
  mustChangePwd: boolean;
  permissions: Perm[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** 校验登录态。每次请求都回表确认账号仍有效（100 人规模开销可忽略，停用立即生效）。 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[config.cookieName] as string | undefined;
  const payload = token ? verifyToken(token) : null;
  if (!payload) throw Errors.unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      orgId: true,
      isActive: true,
      mustChangePwd: true,
      passwordHash: true,
    },
  });
  if (!user || !user.isActive) throw Errors.unauthorized('账号不存在或已停用');
  if (payload.pv !== pwdVersion(user.passwordHash)) throw Errors.unauthorized('密码已变更，请重新登录');
  if (user.role === 'ORG' && !user.orgId) throw Errors.forbidden('机构账号未绑定机构，请联系管理员');

  req.user = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    orgId: user.orgId,
    mustChangePwd: user.mustChangePwd,
    permissions: permsOf(user.role),
  };
  next();
}

/** 首次登录必须先改密码，业务接口一律拦截 */
export function requirePasswordReady(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.mustChangePwd) throw Errors.forbidden('请先修改初始密码');
  next();
}

/** 满足任意一个权限点即可 */
export function requirePerm(...perms: Perm[]) {
  return <P>(req: Request<P>, _res: Response, next: NextFunction) => {
    const owned = req.user?.permissions ?? [];
    if (!perms.some((p) => owned.includes(p))) throw Errors.forbidden();
    next();
  };
}
