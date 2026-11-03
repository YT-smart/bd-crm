/**
 * 业务枚举。取值与 Prisma schema 中的 enum 保持一致（字符串相同），
 * 前端不依赖 @prisma/client，因此在这里单独维护一份。
 */

export const Role = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  ORG: 'ORG',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: '管理员',
  STAFF: '员工',
  ORG: '机构',
};

export const OrgStatus = {
  NEGOTIATING: 'NEGOTIATING',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  TERMINATED: 'TERMINATED',
} as const;
export type OrgStatus = (typeof OrgStatus)[keyof typeof OrgStatus];

export const ORG_STATUS_LABEL: Record<OrgStatus, string> = {
  NEGOTIATING: '洽谈中',
  ACTIVE: '合作中',
  PAUSED: '暂停',
  TERMINATED: '终止',
};

/** 待审核 / 已驳回 / 待到账 / 已结算 */
export const DealStatus = {
  PENDING_AUDIT: 'PENDING_AUDIT',
  REJECTED: 'REJECTED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  SETTLED: 'SETTLED',
} as const;
export type DealStatus = (typeof DealStatus)[keyof typeof DealStatus];

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  PENDING_AUDIT: '待审核',
  REJECTED: '已驳回',
  PENDING_PAYMENT: '待到账',
  SETTLED: '已结算',
};

/** 已核实的成交（计入成交额统计） */
export const APPROVED_DEAL_STATUSES: readonly DealStatus[] = [
  DealStatus.PENDING_PAYMENT,
  DealStatus.SETTLED,
];

export const SettleCycle = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
} as const;
export type SettleCycle = (typeof SettleCycle)[keyof typeof SettleCycle];

export const SETTLE_CYCLE_LABEL: Record<SettleCycle, string> = {
  MONTHLY: '月结',
  QUARTERLY: '季结',
};

export const ORG_LEVELS = ['A', 'B', 'C'] as const;
export type OrgLevel = (typeof ORG_LEVELS)[number];

/** 机构附件分类 */
export const AttachmentCategory = {
  LICENSE: 'LICENSE',
  INTRO: 'INTRO',
  CASE: 'CASE',
  QUALIFICATION: 'QUALIFICATION',
  CONTRACT: 'CONTRACT',
  OTHER: 'OTHER',
} as const;
export type AttachmentCategory = (typeof AttachmentCategory)[keyof typeof AttachmentCategory];

export const ATTACHMENT_CATEGORY_LABEL: Record<AttachmentCategory, string> = {
  LICENSE: '营业执照',
  INTRO: '机构介绍',
  CASE: '成功案例',
  QUALIFICATION: '资质证书',
  CONTRACT: '合同协议',
  OTHER: '其他',
};

/** 单个附件大小上限（MB） */
export const ATTACHMENT_MAX_MB = 20;

export const BUSINESS_TYPES = [
  '留学申请',
  '语言培训',
  '背景提升',
  '低龄留学',
  '游学营地',
  '移民咨询',
] as const;

export const COUNTRIES = [
  '美国',
  '英国',
  '加拿大',
  '澳大利亚',
  '新西兰',
  '新加坡',
  '中国香港',
  '日本',
  '韩国',
  '德国',
  '法国',
  '荷兰',
  '爱尔兰',
  '马来西亚',
] as const;
