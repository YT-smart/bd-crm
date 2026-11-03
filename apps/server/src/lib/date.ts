import type { DashboardRange } from '@bdcrm/shared';

export interface DateRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

/**
 * 当前区间：本期起点 -> 现在；对比区间：上一个完整周期的同等时长（同比口径的环比）。
 * 例：10 月 30 日看「本月」，对比 9 月 1 日 ~ 9 月 30 日同一时刻。
 */
export function resolveRange(range: DashboardRange, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  let start: Date;
  let prevStart: Date;
  if (range === 'year') {
    start = new Date(y, 0, 1);
    prevStart = new Date(y - 1, 0, 1);
  } else if (range === 'quarter') {
    const q = Math.floor(m / 3) * 3;
    start = new Date(y, q, 1);
    prevStart = new Date(y, q - 3, 1);
  } else {
    start = new Date(y, m, 1);
    prevStart = new Date(y, m - 1, 1);
  }
  const elapsed = now.getTime() - start.getTime();
  const prevEnd = new Date(Math.min(prevStart.getTime() + elapsed, start.getTime()));
  return { start, end: now, prevStart, prevEnd };
}

/** 最近 n 个月的 YYYY-MM 列表（含当月，升序） */
export function lastMonths(n: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function monthStart(offset: number, now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

export function deltaPercent(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 10000) / 100;
}

/** YYYY-MM-DD 校验（筛选参数用） */
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 把前端传来的「北京时间日期」转成 UTC 时间区间：
 * startDate 当天 00:00 ~ endDate 当天 23:59:59.999（均为 +08:00）
 */
export function dayRange(startDate?: string, endDate?: string): { gte?: Date; lte?: Date } | undefined {
  if (!startDate && !endDate) return undefined;
  const r: { gte?: Date; lte?: Date } = {};
  if (startDate) r.gte = new Date(`${startDate}T00:00:00.000+08:00`);
  if (endDate) r.lte = new Date(`${endDate}T23:59:59.999+08:00`);
  return r;
}

/** 按北京时间格式化为 YYYY-MM-DD（导出用，避免 toISOString 的 UTC 偏移） */
export function fmtDay(d: Date | null | undefined): string {
  if (!d) return '';
  const t = new Date(d.getTime() + 8 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}
