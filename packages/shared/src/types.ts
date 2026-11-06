import type { DealStatus, OrgStatus, Role, SettleCycle } from './enums';
import type { Perm } from './permissions';

/** 统一响应：{ code, data, message }，code = 0 表示成功 */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  role: Role;
  orgId: string | null;
  orgName: string | null;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  mustChangePwd: boolean;
  lastLoginAt: string | null;
  permissions: Perm[];
}

export interface LoginLogItem {
  id: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  reason: string | null;
  createdAt: string;
}

/* ---------------- 仪表盘 ---------------- */

export type DashboardRange = 'month' | 'quarter' | 'year';

export interface MetricWithDelta {
  value: number;
  previous: number;
  /** 环比，百分比数值（如 12.5 表示 +12.5%）；上期为 0 时为 null */
  delta: number | null;
}

export interface DashboardSummary {
  range: DashboardRange;
  orgTotal: number;
  orgNew: MetricWithDelta;
  dealCount: MetricWithDelta;
  dealAmount: MetricWithDelta;
  commissionIncome: MetricWithDelta;
  receivable: { amount: number; count: number };
  pendingAuditCount: number;
}

export interface TrendPoint {
  month: string; // YYYY-MM
  dealCount: number;
  amount: number;
  commission: number;
  settled: number;
  newOrgs: number;
}

export interface ProvinceStat {
  name: string; // 省份全称，与地图一致
  count: number;
  active: number;
  dealCount: number;
  amount: number;
  commission: number;
  topCities: string[];
}

export interface NameValue {
  name: string;
  value: number;
}

export interface TopOrgItem {
  id: string;
  name: string;
  commission: number;
  amount: number;
  dealCount: number;
}

export interface DashboardDistribution {
  provinces: ProvinceStat[];
  businessTypes: NameValue[];
  topOrgs: TopOrgItem[];
}

/** 地图筛选：按机构名称 / 业务类型找出机构，并按校区城市落到地图上 */
export interface MapSearchQuery {
  keyword?: string;
  businessType?: string;
}
export interface MapAreaStat {
  name: string;
  /** 在该省 / 城市有校区的机构数 */
  count: number;
  /** 机构名称（最多 8 个） */
  orgs: string[];
}
export interface MapCityStat extends MapAreaStat {
  province: string;
}
export interface MapSearchResult {
  orgCount: number;
  /** 命中的机构（最多 20 个），用于结果列表 */
  orgs: { id: string; name: string; cities: string[] }[];
  provinces: MapAreaStat[];
  cities: MapCityStat[];
}

export interface DealBrief {
  id: string;
  orgId: string;
  orgName: string;
  studentName: string;
  amount: number;
  commission: number;
  status: DealStatus;
  dealAt: string;
  createdAt: string;
}

export interface OrgBrief {
  id: string;
  name: string;
  city: string | null;
  completeness: number;
  status: OrgStatus;
}

export interface DashboardLists {
  pendingDeals: DealBrief[];
  recentDeals: DealBrief[];
  incompleteOrgs: OrgBrief[];
}

export interface MyOrgDashboard {
  org: {
    id: string;
    name: string;
    status: OrgStatus;
    level: string | null;
    defaultRate: number;
    completeness: number;
    missing: string[];
  };
  totals: {
    dealCount: number;
    amount: number;
    commission: number;
    settled: number;
    unsettled: number;
    pendingAudit: number;
    rejected: number;
  };
  recentDeals: DealBrief[];
}

/* ---------------- 机构 ---------------- */

export interface OrgListItem {
  id: string;
  name: string;
  province: string | null;
  city: string | null;
  /** 校区城市（含总部城市） */
  officeCities: string[];
  /** 覆盖国家和地区 */
  countries: string[];
  status: OrgStatus;
  level: string | null;
  defaultRate: number;
  businessTypes: string[];
  tags: string[];
  completeness: number;
  ownerName: string | null;
  dealCount: number;
  /** 报单总数（含待审核、已驳回） */
  reportCount: number;
  /** 成交率 = 已核实成交 / 报单总数（%），没有报单时为 null */
  dealRate: number | null;
  dealAmount: number;
  commission: number;
  lastDealAt: string | null;
  createdAt: string;
}

export interface OrgListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  province?: string;
  status?: OrgStatus;
  level?: string;
  /** 覆盖国家和地区 */
  country?: string;
  /** 城市：总部城市或任一校区城市命中 */
  city?: string;
  /** 业务类型 */
  businessType?: string;
  sort?: 'createdAt' | 'defaultRate' | 'name' | 'level' | 'dealCount' | 'dealRate';
  order?: 'asc' | 'desc';
}

/* -- 机构详情 -- */

export interface OrgContactItem {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  wechat: string | null;
  email: string | null;
  isPrimary: boolean;
}

export interface OrgProductItem {
  id: string;
  name: string;
  type: string;
  priceMin: number | null;
  priceMax: number | null;
  rate: number | null;
  /** 推荐级别 1-4，1 为主推；未设置为 null */
  level: number | null;
  note: string | null;
}

/** 机构评价：员工和管理员可见、可写，机构账号看不到 */
export interface OrgReviewItem {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface OrgFollowUpItem {
  id: string;
  userId: string;
  userName: string;
  method: string;
  content: string;
  followAt: string;
  createdAt: string;
}

export interface OrgAttachmentItem {
  id: string;
  category: string;
  name: string;
  url: string;
  size: number;
  mime: string | null;
  uploadedById: string | null;
  uploadedByName: string | null;
  createdAt: string;
}

export interface OrgDetail {
  id: string;
  name: string;
  logo: string | null;
  advantage: string | null;
  intro: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  wechat: string | null;
  /** 是否已上传公众号二维码（图片经 /orgs/:id/wechat-qr 获取） */
  hasWechatQr: boolean;
  foundedAt: string | null;
  scale: string | null;
  businessTypes: string[];
  countries: string[];
  officeCities: string[];
  tags: string[];
  level: string | null;
  status: OrgStatus;
  defaultRate: number;
  settleCycle: SettleCycle | null;
  bankInfo: OrgBankInfo | null;
  contractStart: string | null;
  contractEnd: string | null;
  ownerId: string | null;
  ownerName: string | null;
  completeness: number;
  missing: string[];
  createdAt: string;
  updatedAt: string;

  contacts: OrgContactItem[];
  products: OrgProductItem[];
  stats: OrgStats;
}

export interface OrgBankInfo {
  bankName?: string;
  accountName?: string;
  accountNo?: string;
  note?: string;
}

export interface OrgStats {
  dealCount: number;
  dealAmount: number;
  commission: number;
  settled: number;
  unsettled: number;
  pendingAudit: number;
}

/* -- 机构新增/编辑 -- */

export interface OrgCreateInput {
  name: string;
  province?: string | null;
  city?: string | null;
  defaultRate: number;
  ownerId?: string | null;
  createAccount?: boolean;
  accountUsername?: string;
  accountName?: string;
  /** 留空则由后端自动生成 */
  accountPassword?: string;
}

export interface OrgCreateResult {
  id: string;
  name: string;
  /** 仅在创建时返回一次初始密码，之后无法再查看 */
  account: { username: string; name: string; password: string } | null;
}

export interface OrgUpdateInput {
  name?: string;
  logo?: string | null;
  advantage?: string | null;
  intro?: string | null;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  website?: string | null;
  wechat?: string | null;
  foundedAt?: string | null;
  scale?: string | null;
  businessTypes?: string[];
  countries?: string[];
  officeCities?: string[];
  tags?: string[];
  level?: string | null;
  status?: OrgStatus;
  defaultRate?: number;
  settleCycle?: SettleCycle | null;
  bankInfo?: OrgBankInfo | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  ownerId?: string | null;
}

export interface ContactInput {
  name: string;
  title?: string | null;
  phone?: string | null;
  wechat?: string | null;
  email?: string | null;
  isPrimary?: boolean;
}

export interface ProductInput {
  name: string;
  type: string;
  priceMin?: number | null;
  priceMax?: number | null;
  rate?: number | null;
  level?: number | null;
  note?: string | null;
}

export interface FollowUpInput {
  method: string;
  content: string;
  followAt: string;
}

/** 用于前端下拉选择员工 */
export interface StaffOption {
  id: string;
  name: string;
}

/** 导入预览行 */
export interface ImportPreviewRow {
  rowNo: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

export interface ImportResult {
  total: number;
  inserted: number;
  failed: number;
  errors: Array<{ rowNo: number; message: string }>;
}

/* ================ 成交与结算 ================ */

export interface DealListItem {
  id: string;
  orgId: string;
  orgName: string;
  productName: string | null;
  studentName: string;
  studentPhone: string | null;
  dealAt: string;
  amount: number;
  rate: number;
  commission: number;
  status: DealStatus;
  rejectReason: string | null;
  createdByName: string;
  auditedByName: string | null;
  auditedAt: string | null;
  settledAt: string | null;
  settledByName: string | null;
  settleNote: string | null;
  note: string | null;
  createdAt: string;
}

export interface DealListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  orgId?: string;
  status?: DealStatus;
  startDate?: string;
  endDate?: string;
  sort?: 'dealAt' | 'amount' | 'commission' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface DealCreateInput {
  orgId: string;
  productId?: string | null;
  studentName: string;
  studentPhone?: string | null;
  dealAt: string;
  amount: number;
  rate: number;
  commission: number;
  note?: string | null;
}

export interface DealUpdateInput {
  productId?: string | null;
  studentName?: string;
  studentPhone?: string | null;
  dealAt?: string;
  amount?: number;
  rate?: number;
  commission?: number;
  note?: string | null;
}

export interface DealAuditInput {
  action: 'approve' | 'reject';
  rejectReason?: string;
}

export interface DealSettleInput {
  dealIds: string[];
  settledAt: string;
  settleNote?: string;
}

export interface DealRevokeInput {
  reason: string;
}

export interface DealSummary {
  total: number;
  pendingAudit: number;
  pendingPayment: number;
  settled: number;
  rejected: number;
  pendingPaymentAmount: number;
  settledAmount: number;
}

/** 某个时间段的成交统计（按成交日期） */
export interface DealPeriodStat {
  /** 已核实成交（待到账 + 已结算） */
  count: number;
  amount: number;
  commission: number;
  /** 报单总数（含待审核、已驳回） */
  reports: number;
  /** 成交率 = count / reports（%），无报单为 null */
  rate: number | null;
}

/** 成交概览（管理员）：今日 / 本周 / 本月对比上期同期，及近 30 天走势 */
export interface DealOverview {
  today: DealPeriodStat;
  yesterday: DealPeriodStat;
  week: DealPeriodStat;
  lastWeek: DealPeriodStat;
  month: DealPeriodStat;
  lastMonth: DealPeriodStat;
  all: DealPeriodStat;
  /** 各区间起点（YYYY-MM-DD，北京时间），用于点击筛选 */
  ranges: { today: string; weekStart: string; monthStart: string };
  daily: ({ date: string } & DealPeriodStat)[];
}

/** 机构成交选项（用于成交录入时选择机构与产品） */
export interface OrgOption {
  id: string;
  name: string;
  defaultRate: number;
  products: Array<{ id: string; name: string; type: string; rate: number | null }>;
}

