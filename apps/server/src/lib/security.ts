import { createHmac, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import type { Role } from '@bdcrm/shared';

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export interface TokenPayload {
  sub: string;
  role: Role;
  /** 密码版本指纹：密码变更后旧令牌自动失效 */
  pv?: string;
}

/** 由密码哈希派生的短指纹（HMAC，不暴露哈希本身） */
export function pwdVersion(passwordHash: string) {
  return createHmac('sha256', config.jwtSecret).update(passwordHash).digest('base64url').slice(0, 16);
}

export function signToken(payload: TokenPayload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}

/** 至少 8 位，同时包含字母和数字 */
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

/** 生成随机初始密码：10 位，含大小写字母与数字，剔除 0/O/1/l/I 等易混淆字符 */
export function generatePassword(len = 10): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const pick = (s: string) => s[randomInt(s.length)];
  const chars = [pick(letters), pick(digits)];
  while (chars.length < len) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
