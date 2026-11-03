import 'dotenv/config';

// 统一使用北京时间计算「本月 / 本季度 / 本年」等区间
process.env.TZ = 'Asia/Shanghai';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少环境变量 ${name}，请参考 apps/server/.env.example`);
  return v;
}

export const config = {
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT ?? 3100),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  cookieName: 'bdcrm_token',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieMaxAgeMs: 7 * 24 * 3600 * 1000,
  /** 连续失败次数达到后锁定 */
  loginMaxFailed: 5,
  loginLockMinutes: 15,
  /** 数据库时区，用于 SQL 中按月分组 */
  dbTimezone: 'Asia/Shanghai',
} as const;
