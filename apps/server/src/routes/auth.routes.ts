import { Router, type Response } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { Errors, ok } from '../lib/http';
import { prisma } from '../lib/prisma';
import { PASSWORD_RULE, pwdVersion, signToken, verifyToken } from '../lib/security';
import { requireAuth } from '../middlewares/auth';
import { clientIp, writeAudit } from '../services/audit.service';
import * as authService from '../services/auth.service';

const router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1, '请输入账号').max(64),
  password: z.string().min(1, '请输入密码').max(128),
});

const passwordSchema = z.object({
  oldPassword: z.string().min(1, '请输入原密码'),
  newPassword: z.string().regex(PASSWORD_RULE, '新密码需 8 位以上，且同时包含字母和数字'),
});

function setTokenCookie(res: Response, token: string) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: config.cookieMaxAgeMs,
    path: '/',
  });
}

/* ---------- 按 IP 的登录失败限流（内存级，单实例足够） ---------- */
const IP_MAX_FAILED = 20;
const IP_WINDOW_MS = 15 * 60 * 1000;
const ipFails = new Map<string, { count: number; resetAt: number }>();

function ipBlocked(ip: string) {
  const r = ipFails.get(ip);
  if (!r) return false;
  if (r.resetAt < Date.now()) {
    ipFails.delete(ip);
    return false;
  }
  return r.count >= IP_MAX_FAILED;
}

function ipFail(ip: string) {
  const now = Date.now();
  const r = ipFails.get(ip);
  if (!r || r.resetAt < now) ipFails.set(ip, { count: 1, resetAt: now + IP_WINDOW_MS });
  else r.count += 1;
  // 简单清理，避免 Map 无限增长
  if (ipFails.size > 5000) for (const [k, v] of ipFails) if (v.resetAt < now) ipFails.delete(k);
}

router.post('/login', async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const ip = clientIp(req) ?? 'unknown';
  if (ipBlocked(ip)) throw Errors.tooMany('登录失败次数过多，请 15 分钟后再试');

  let user: Awaited<ReturnType<typeof authService.login>>;
  try {
    user = await authService.login(username, password, { ip, userAgent: req.get('user-agent') ?? null });
  } catch (e) {
    ipFail(ip);
    throw e;
  }
  ipFails.delete(ip);
  setTokenCookie(res, signToken({ sub: user.id, role: user.role, pv: pwdVersion(user.passwordHash) }));
  await writeAudit(req, {
    module: 'auth',
    action: 'login',
    targetId: user.id,
    targetName: user.username,
    actor: { id: user.id, name: user.name, role: user.role },
  });
  ok(res, authService.toProfile(user));
});

router.post('/logout', async (req, res) => {
  // 登出不强制要求有效登录态，能识别身份时记录日志
  const token = req.cookies?.[config.cookieName] as string | undefined;
  const payload = token ? verifyToken(token) : null;
  if (payload) {
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, username: true, role: true } });
    if (user) {
      await writeAudit(req, {
        module: 'auth',
        action: 'logout',
        targetId: user.id,
        targetName: user.username,
        actor: { id: user.id, name: user.name, role: user.role },
      });
    }
  }
  res.clearCookie(config.cookieName, { path: '/' });
  ok(res, null);
});

router.get('/me', requireAuth, async (req, res) => {
  ok(res, await authService.getProfile(req.user!.id));
});

router.put('/password', requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = passwordSchema.parse(req.body);
  const profile = await authService.changePassword(req.user!.id, oldPassword, newPassword);
  // 密码已变，旧令牌全部失效；给当前设备重发一个
  const fresh = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { passwordHash: true } });
  setTokenCookie(res, signToken({ sub: req.user!.id, role: req.user!.role, pv: pwdVersion(fresh!.passwordHash) }));
  await writeAudit(req, { module: 'auth', action: 'change_password', targetId: req.user!.id, targetName: req.user!.username });
  ok(res, profile, '密码已修改');
});

router.get('/login-logs', requireAuth, async (req, res) => {
  ok(res, await authService.recentLogins(req.user!.id));
});

export default router;
