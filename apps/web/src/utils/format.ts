const moneyFmt = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const money2Fmt = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numFmt = new Intl.NumberFormat('zh-CN');

/** ¥1,286,400 */
export function money(v: number | null | undefined, decimals = false) {
  const n = v ?? 0;
  return `¥${decimals ? money2Fmt.format(n) : moneyFmt.format(Math.round(n))}`;
}

/** 大额缩写：¥128.6万 / ¥1.29亿 */
export function moneyShort(v: number | null | undefined) {
  const n = v ?? 0;
  if (Math.abs(n) >= 1e8) return `¥${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `¥${(n / 1e4).toFixed(1)}万`;
  return money(n);
}

export function num(v: number | null | undefined) {
  return numFmt.format(v ?? 0);
}

export function percent(v: number | null | undefined, digits = 1) {
  if (v == null) return '--';
  return `${v.toFixed(digits)}%`;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function date(v: string | number | Date | null | undefined) {
  if (v == null || v === '') return '--';
  const d = v instanceof Date ? v : new Date(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateTime(v: string | number | Date | null | undefined) {
  if (v == null || v === '') return '--';
  const d = v instanceof Date ? v : new Date(v);
  return `${date(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 2026-03 -> 3月 */
export function monthLabel(ym: string) {
  return `${Number(ym.slice(5, 7))}月`;
}

/** 解析 UA 为「Chrome · Windows」这样的简短描述 */
export function shortUA(ua: string | null) {
  if (!ua) return '--';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : '其他浏览器';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua)
      ? 'macOS'
      : /Android/.test(ua)
        ? 'Android'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return os ? `${browser} · ${os}` : browser;
}
