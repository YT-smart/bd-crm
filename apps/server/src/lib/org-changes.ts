import { ATTACHMENT_CATEGORY_LABEL, ORG_STATUS_LABEL, SETTLE_CYCLE_LABEL, type ChangeLine } from '@bdcrm/shared';
import { fmtDay } from './date';

/**
 * 机构资料修改前后对比，生成给人看的「改了什么」。
 * 用于消息提醒：机构账号改了资料后，员工 / 管理员点开提醒能看到具体内容。
 */

type Fmt = (v: unknown) => string | null;

const EMPTY = null;
const text: Fmt = (v) => (v == null || v === '' ? EMPTY : String(v).trim() || EMPTY);
const list: Fmt = (v) => (Array.isArray(v) && v.length ? v.join('、') : EMPTY);
const day: Fmt = (v) => (v ? fmtDay(v instanceof Date ? v : new Date(String(v))) || EMPTY : EMPTY);
/** 成立年份：存的是当年 1 月 1 日（UTC），只显示年 */
const year: Fmt = (v) => {
  if (!v) return EMPTY;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? EMPTY : `${d.getUTCFullYear()} 年`;
};
const pct: Fmt = (v) => (v == null || v === '' ? EMPTY : `${Number(v)}%`);
const yuan: Fmt = (v) => (v == null || v === '' ? EMPTY : `¥${Number(v).toLocaleString('zh-CN')}`);
const bank: Fmt = (v) => {
  if (!v || typeof v !== 'object') return EMPTY;
  const b = v as Record<string, string | undefined>;
  const parts = [b.bankName, b.accountName, b.accountNo, b.note].filter((x) => x && String(x).trim());
  return parts.length ? parts.join(' · ') : EMPTY;
};
const campus: Fmt = (v) =>
  Array.isArray(v) && v.length
    ? (v as { city: string; address: string }[]).map((c) => `${c.city}：${c.address}`).join('；')
    : EMPTY;
const image: Fmt = (v) => (v ? '已设置' : EMPTY);

/** 机构字段：标签、格式化、是否只有管理员能看具体值 */
const ORG_FIELDS: Record<string, { label: string; fmt: Fmt; sensitive?: boolean }> = {
  name: { label: '机构名称', fmt: text },
  logo: { label: '机构 Logo', fmt: image },
  advantage: { label: '一句话优势', fmt: text },
  intro: { label: '机构简介', fmt: text },
  province: { label: '所在省份', fmt: text },
  city: { label: '总部城市', fmt: text },
  website: { label: '官网', fmt: text },
  wechat: { label: '公众号', fmt: text },
  foundedAt: { label: '成立年份', fmt: year },
  scale: { label: '机构规模', fmt: text },
  businessTypes: { label: '业务类型', fmt: list },
  countries: { label: '覆盖国家和地区', fmt: list },
  officeCities: { label: '校区城市', fmt: list },
  campusAddresses: { label: '校区地址', fmt: campus },
  tags: { label: '标签', fmt: list },
  level: { label: '机构等级', fmt: text },
  status: { label: '合作状态', fmt: (v) => (v ? ORG_STATUS_LABEL[v as keyof typeof ORG_STATUS_LABEL] ?? String(v) : EMPTY) },
  cooperateAt: { label: '合作时间', fmt: day },
  defaultRate: { label: '默认佣金比例', fmt: pct, sensitive: true },
  settleCycle: { label: '结算周期', fmt: (v) => (v ? SETTLE_CYCLE_LABEL[v as keyof typeof SETTLE_CYCLE_LABEL] ?? String(v) : EMPTY), sensitive: true },
  bankInfo: { label: '收款账户', fmt: bank, sensitive: true },
  contractStart: { label: '合同开始', fmt: day, sensitive: true },
  contractEnd: { label: '合同结束', fmt: day, sensitive: true },
};

/** 机构基本信息：只对比这次提交的字段 */
export function diffOrg(before: Record<string, unknown>, data: Record<string, unknown>): ChangeLine[] {
  const out: ChangeLine[] = [];
  for (const [k, v] of Object.entries(data)) {
    const f = ORG_FIELDS[k];
    if (!f) continue;
    const a = f.fmt(before[k]);
    const b = f.fmt(v);
    if (a === b) continue;
    out.push({ label: f.label, before: a, after: b, ...(f.sensitive ? { sensitive: true } : {}) });
  }
  return out;
}

/* ---------- 联系人 ---------- */

const CONTACT_FIELDS: Record<string, { label: string; fmt: Fmt }> = {
  name: { label: '姓名', fmt: text },
  title: { label: '职务', fmt: text },
  phone: { label: '电话', fmt: text },
  wechat: { label: '微信', fmt: text },
  email: { label: '邮箱', fmt: text },
  isPrimary: { label: '主联系人', fmt: (v) => (v ? '是' : '否') },
};

type Rec = Record<string, unknown>;

export function contactSummary(c: Rec) {
  return [c.name, c.title, c.phone, c.wechat ? `微信 ${c.wechat}` : null, c.email].filter((x) => x).join(' · ');
}

export function diffContact(before: Rec, input: Rec): ChangeLine[] {
  const out: ChangeLine[] = [];
  for (const [k, v] of Object.entries(input)) {
    const f = CONTACT_FIELDS[k];
    if (!f) continue;
    const a = f.fmt(before[k]);
    const b = f.fmt(v);
    if (a !== b) out.push({ label: `联系人「${before.name}」· ${f.label}`, before: a, after: b });
  }
  return out;
}

/* ---------- 产品 ---------- */

const PRODUCT_FIELDS: Record<string, { label: string; fmt: Fmt; sensitive?: boolean }> = {
  name: { label: '产品名称', fmt: text },
  type: { label: '业务类型', fmt: text },
  level: { label: '推荐级别', fmt: (v) => (v == null ? EMPTY : `${v} 级`) },
  priceMin: { label: '最低报价', fmt: yuan },
  priceMax: { label: '最高报价', fmt: yuan },
  rate: { label: '佣金比例', fmt: pct, sensitive: true },
  grades: { label: '客户年级', fmt: list },
  note: { label: '备注说明', fmt: text },
};

/** 产品概要（不含佣金比例，员工也能看） */
export function productSummary(p: Rec) {
  const price = p.priceMin != null || p.priceMax != null ? `${yuan(p.priceMin) ?? '?'} ~ ${yuan(p.priceMax) ?? '?'}` : null;
  return [p.name, p.type, p.level != null ? `${p.level} 级` : null, price, list(p.grades)].filter((x) => x).join(' · ');
}

export function diffProduct(before: Rec, input: Rec): ChangeLine[] {
  const out: ChangeLine[] = [];
  for (const [k, v] of Object.entries(input)) {
    const f = PRODUCT_FIELDS[k];
    if (!f) continue;
    const a = f.fmt(before[k]);
    const b = f.fmt(v);
    if (a !== b) out.push({ label: `产品「${before.name}」· ${f.label}`, before: a, after: b, ...(f.sensitive ? { sensitive: true } : {}) });
  }
  return out;
}

export const attachmentCategoryLabel = (c: string) => ATTACHMENT_CATEGORY_LABEL[c as keyof typeof ATTACHMENT_CATEGORY_LABEL] ?? c;
