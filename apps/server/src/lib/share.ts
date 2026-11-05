import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

/**
 * 附件分享链接令牌：base64url(附件 id + 过期时间) + HMAC 签名。
 * 不落库；附件删除后链接自动失效。expiresAt = 0 表示永久有效。
 */
const sign = (body: string) => createHmac('sha256', `${config.jwtSecret}:share`).update(body).digest('base64url').slice(0, 32);

export function createShareToken(attachmentId: string, expiresAt: number) {
  const body = Buffer.from(`${attachmentId}.${expiresAt}`).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function verifyShareToken(token: string): { attachmentId: string; expiresAt: number } | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const [attachmentId, exp] = Buffer.from(body, 'base64url').toString().split('.');
  const expiresAt = Number(exp);
  if (!attachmentId || !Number.isFinite(expiresAt)) return null;
  if (expiresAt && expiresAt < Date.now()) return null;
  return { attachmentId, expiresAt };
}
