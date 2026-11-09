import type {
  ContactInput,
  DashboardDistribution,
  DashboardLists,
  DashboardRange,
  DashboardSummary,
  DealAuditInput,
  DealCreateInput,
  DealListItem,
  DealListQuery,
  DealSettleInput,
  DealSummary,
  DealOverview,
  DealUpdateInput,
  FollowUpInput,
  ImportResult,
  LoginLogItem,
  MyOrgDashboard,
  OrgAttachmentItem,
  OrgCreateInput,
  OrgCreateResult,
  OrgDetail,
  OrgFollowUpItem,
  OrgListItem,
  OrgListQuery,
  OrgOption,
  OrgUpdateInput,
  PageResult,
  ProductInput,
  StaffOption,
  TrendPoint,
  UserProfile,
  OrgReviewItem,
  MapSearchQuery,
  MapSearchResult,
  LeadDetail,
  LeadInput,
  LeadListItem,
  LeadListQuery,
  LeadSignInput,
  LeadStatusCounts,
} from '@bdcrm/shared';
import { http } from './http';

export const authApi = {
  login: (username: string, password: string) => http.post<UserProfile>('/auth/login', { username, password }),
  logout: () => http.post<null>('/auth/logout'),
  me: () => http.get<UserProfile>('/auth/me', undefined, { silent: true }),
  changePassword: (oldPassword: string, newPassword: string) =>
    http.put<UserProfile>('/auth/password', { oldPassword, newPassword }),
  loginLogs: () => http.get<LoginLogItem[]>('/auth/login-logs'),
};

export const dashboardApi = {
  summary: (range: DashboardRange) => http.get<DashboardSummary>('/dashboard/summary', { range }),
  trend: () => http.get<TrendPoint[]>('/dashboard/trend'),
  distribution: (range: DashboardRange) => http.get<DashboardDistribution>('/dashboard/distribution', { range }),
  lists: () => http.get<DashboardLists>('/dashboard/lists'),
  map: (q: MapSearchQuery) => http.get<MapSearchResult>('/dashboard/map', { ...q }),
  my: () => http.get<MyOrgDashboard>('/dashboard/my'),
};

export const orgApi = {
  /* 列表 */
  list: (q: OrgListQuery) => http.get<PageResult<OrgListItem>>('/orgs', { ...q }),
  staffOptions: () => http.get<StaffOption[]>('/orgs/staff-options'),
  exportData: (q: OrgListQuery) => http.get<Record<string, unknown>[]>('/orgs/export', { ...q }),

  /* CRUD */
  detail: (id: string) => http.get<OrgDetail>(`/orgs/${id}`),
  create: (data: OrgCreateInput) => http.post<OrgCreateResult>('/orgs', data),
  update: (id: string, data: OrgUpdateInput) => http.put<{ id: string }>(`/orgs/${id}`, data),
  remove: (id: string) => http.del<null>(`/orgs/${id}`),

  /* 联系人 */
  addContact: (orgId: string, data: ContactInput) => http.post<{ id: string }>(`/orgs/${orgId}/contacts`, data),
  updateContact: (orgId: string, contactId: string, data: Partial<ContactInput>) =>
    http.put<null>(`/orgs/${orgId}/contacts/${contactId}`, data),
  deleteContact: (orgId: string, contactId: string) => http.del<null>(`/orgs/${orgId}/contacts/${contactId}`),

  /* 产品 */
  addProduct: (orgId: string, data: ProductInput) => http.post<{ id: string }>(`/orgs/${orgId}/products`, data),
  updateProduct: (orgId: string, productId: string, data: Partial<ProductInput>) =>
    http.put<null>(`/orgs/${orgId}/products/${productId}`, data),
  deleteProduct: (orgId: string, productId: string) => http.del<null>(`/orgs/${orgId}/products/${productId}`),

  /* 跟进记录 */
  followUps: (orgId: string) => http.get<OrgFollowUpItem[]>(`/orgs/${orgId}/follow-ups`),
  addFollowUp: (orgId: string, data: FollowUpInput) =>
    http.post<{ id: string }>(`/orgs/${orgId}/follow-ups`, data),
  deleteFollowUp: (orgId: string, fuId: string) => http.del<null>(`/orgs/${orgId}/follow-ups/${fuId}`),

  /* 机构评价（内部） */
  reviews: (orgId: string) => http.get<OrgReviewItem[]>(`/orgs/${orgId}/reviews`),
  addReview: (orgId: string, content: string) => http.post<{ id: string }>(`/orgs/${orgId}/reviews`, { content }),
  deleteReview: (orgId: string, reviewId: string) => http.del<null>(`/orgs/${orgId}/reviews/${reviewId}`),

  /* 附件 */
  attachments: (orgId: string) => http.get<OrgAttachmentItem[]>(`/orgs/${orgId}/attachments`),
  uploadAttachments: (orgId: string, category: string, files: File[], onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append('category', category);
    for (const f of files) form.append('files', f, f.name);
    return http.upload<OrgAttachmentItem[]>(`/orgs/${orgId}/attachments`, form, onProgress);
  },
  attachmentUrl: (orgId: string, attId: string, inline = false) =>
    `/api/orgs/${orgId}/attachments/${attId}/download${inline ? '?inline=1' : ''}`,
  deleteAttachment: (orgId: string, attId: string) => http.del<null>(`/orgs/${orgId}/attachments/${attId}`),
  /** 生成免登录分享链接，days = 0 表示永久有效 */
  shareAttachment: (orgId: string, attId: string, days: 0 | 1 | 7 | 30) =>
    http.post<{ token: string; expiresAt: string | null }>(`/orgs/${orgId}/attachments/${attId}/share`, { days }),
  /** 公众号二维码图片地址（v 用于上传后刷新缓存） */
  wechatQrUrl: (orgId: string, v?: string | number) => `/api/orgs/${orgId}/wechat-qr${v ? `?v=${v}` : ''}`,
  uploadWechatQr: (orgId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return http.upload<null>(`/orgs/${orgId}/wechat-qr`, form);
  },
  deleteWechatQr: (orgId: string) => http.del<null>(`/orgs/${orgId}/wechat-qr`),
};

export interface SharedFileMeta {
  name: string;
  size: number;
  orgName: string;
  createdAt: string;
  expiresAt: string | null;
}

/** 附件分享（免登录） */
export const shareApi = {
  meta: (token: string) => http.get<SharedFileMeta>(`/share/${encodeURIComponent(token)}`, undefined, { silent: true }),
  fileUrl: (token: string, inline = false) => `/api/share/${encodeURIComponent(token)}/file${inline ? '?inline=1' : ''}`,
};

export const dealApi = {
  summary: () => http.get<DealSummary>('/deals/summary'),
  overview: () => http.get<DealOverview>('/deals/overview'),
  list: (q: DealListQuery) => http.get<PageResult<DealListItem>>('/deals', { ...q }),
  orgOptions: () => http.get<OrgOption[]>('/deals/org-options'),
  exportData: (q: DealListQuery) => http.get<Record<string, unknown>[]>('/deals/export', { ...q }),

  create: (data: DealCreateInput) => http.post<{ id: string }>('/deals', data),
  update: (id: string, data: DealUpdateInput) => http.put<{ id: string }>(`/deals/${id}`, data),

  audit: (id: string, data: DealAuditInput) => http.post<{ status: string }>(`/deals/${id}/audit`, data),
  batchApprove: (dealIds: string[]) => http.post<{ updated: number }>('/deals/batch-approve', { dealIds }),

  settle: (data: DealSettleInput) => http.post<{ updated: number }>('/deals/settle', data),
  revokeSettle: (id: string, reason: string) =>
    http.post<{ status: string }>(`/deals/${id}/revoke-settle`, { reason }),
};

/* ---------- 客户线索 ---------- */

export interface LeadFilterOptions {
  assignees: StaffOption[];
  creators: StaffOption[];
  orgs: StaffOption[];
}

export const leadApi = {
  list: (q: LeadListQuery) => http.get<PageResult<LeadListItem>>('/leads', { ...q }),
  counts: (q: LeadListQuery) => http.get<LeadStatusCounts>('/leads/counts', { ...q }),
  filterOptions: () => http.get<LeadFilterOptions>('/leads/filter-options'),
  exportData: (q: LeadListQuery) => http.get<Record<string, unknown>[]>('/leads/export', { ...q }),
  detail: (id: string) => http.get<LeadDetail>(`/leads/${id}`),
  create: (data: LeadInput) => http.post<{ id: string }>('/leads', data),
  update: (id: string, data: Partial<LeadInput>) => http.put<{ id: string }>(`/leads/${id}`, data),
  remove: (id: string) => http.del<null>(`/leads/${id}`),
  assign: (ids: string[], assigneeId: string | null) => http.post<{ updated: number }>('/leads/assign', { ids, assigneeId }),
  addFollow: (id: string, method: string, content: string) =>
    http.post<{ id: string }>(`/leads/${id}/follows`, { method, content }),
  sign: (id: string, data: LeadSignInput) => http.post<{ dealId: string }>(`/leads/${id}/sign`, data),
};

/* ---------- 操作日志 ---------- */

export interface AuditLogItem {
  id: string;
  userId: string | null;
  userName: string;
  role: string | null;
  module: string;
  action: string;
  targetId: string | null;
  targetName: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  module?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

export const logApi = {
  list: (q: AuditLogQuery) => http.get<PageResult<AuditLogItem>>('/logs', { ...q }),
  modules: () => http.get<string[]>('/logs/modules'),
};

/* ---------- 账号管理 ---------- */

export interface UserItem {
  id: string;
  username: string;
  name: string;
  role: string;
  orgId: string | null;
  orgName: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  mustChangePwd: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  role?: string;
  isActive?: string;
}

export const userApi = {
  list: (q: UserQuery) => http.get<PageResult<UserItem>>('/users', { ...q }),
  create: (data: { username: string; name: string; role: string; orgId?: string | null; phone?: string | null; email?: string | null; password: string }) =>
    http.post<{ id: string }>('/users', data),
  update: (id: string, data: { name?: string; role?: string; orgId?: string | null; phone?: string | null; email?: string | null }) =>
    http.put<{ id: string }>(`/users/${id}`, data),
  toggleActive: (id: string, isActive: boolean) =>
    http.post<{ isActive: boolean }>(`/users/${id}/toggle-active`, { isActive }),
  resetPassword: (id: string, password: string) =>
    http.post<null>(`/users/${id}/reset-password`, { password }),
  remove: (id: string) => http.del<null>(`/users/${id}`),
};

