/**
 * 机构资料完整度。后端在保存机构时计算并写入 Org.completeness，
 * 前端用 missing 列表提示机构补全资料。
 */
export interface CompletenessInput {
  name?: string | null;
  logo?: string | null;
  intro?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  website?: string | null;
  wechat?: string | null;
  businessTypes?: readonly string[] | null;
  countries?: readonly string[] | null;
  bankInfo?: unknown;
  contractStart?: Date | string | null;
  contactCount?: number;
  productCount?: number;
}

interface Rule {
  label: string;
  weight: number;
  test: (o: CompletenessInput) => boolean;
}

const filled = (v?: string | null) => typeof v === 'string' && v.trim().length > 0;

const RULES: Rule[] = [
  { label: '机构名称', weight: 10, test: (o) => filled(o.name) },
  { label: 'Logo', weight: 5, test: (o) => filled(o.logo) },
  { label: '机构简介', weight: 10, test: (o) => filled(o.intro) },
  { label: '所在地区', weight: 10, test: (o) => filled(o.province) && filled(o.city) },
  { label: '详细地址', weight: 5, test: (o) => filled(o.address) },
  { label: '官网', weight: 5, test: (o) => filled(o.website) },
  { label: '公众号', weight: 5, test: (o) => filled(o.wechat) },
  { label: '业务类型', weight: 10, test: (o) => (o.businessTypes?.length ?? 0) > 0 },
  { label: '覆盖国家', weight: 10, test: (o) => (o.countries?.length ?? 0) > 0 },
  { label: '联系人', weight: 10, test: (o) => (o.contactCount ?? 0) > 0 },
  { label: '产品与报价', weight: 10, test: (o) => (o.productCount ?? 0) > 0 },
  { label: '收款账户', weight: 5, test: (o) => o.bankInfo != null },
  { label: '合同信息', weight: 5, test: (o) => o.contractStart != null },
];

const TOTAL = RULES.reduce((s, r) => s + r.weight, 0);

export function computeCompleteness(o: CompletenessInput): { score: number; percentage: number; missing: string[] } {
  let got = 0;
  const missing: string[] = [];
  for (const r of RULES) {
    if (r.test(o)) got += r.weight;
    else missing.push(r.label);
  }
  const percentage = Math.round((got / TOTAL) * 100);
  return { score: percentage, percentage, missing };
}

/** 便利别名：接收一个 Org 记录，自动提取 contacts / products 数量 */
export function calcCompleteness(org: CompletenessInput & { contacts?: unknown[]; products?: unknown[] }) {
  return computeCompleteness({
    ...org,
    contactCount: org.contacts?.length ?? org.contactCount ?? 0,
    productCount: org.products?.length ?? org.productCount ?? 0,
  });
}
