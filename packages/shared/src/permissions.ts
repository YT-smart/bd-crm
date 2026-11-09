import { Role } from './enums';

/**
 * 权限点。后端用 requirePerm() 校验，前端用来控制菜单与按钮。
 * 以后给单个账号追加权限时，只需在 User 上扩展 extraPerms，不改业务代码。
 */
export const PERM = {
  DASHBOARD_GLOBAL: 'dashboard:global',
  DASHBOARD_ORG: 'dashboard:org',
  /** 仪表盘中的成交笔数、成交额、佣金等经营数据（仅管理员） */
  DASHBOARD_FINANCE: 'dashboard:finance',

  ORG_VIEW: 'org:view',
  ORG_CREATE: 'org:create',
  ORG_UPDATE: 'org:update',
  ORG_DELETE: 'org:delete',
  ORG_IMPORT: 'org:import',
  ORG_EXPORT: 'org:export',

  /**
   * 机构里跟钱有关的信息，仅管理员：合作信息（结算周期、合同、收款账户）、
   * 佣金比例、成交记录、合作数据（成交额 / 佣金 / 结算）
   */
  ORG_COOPERATION: 'org:cooperation',
  /** 机构评价（内部），员工和管理员 */
  ORG_REVIEW: 'org:review',

  MY_ORG: 'my-org:manage',

  DEAL_VIEW: 'deal:view',
  /** 查看全部成交；没有该权限的员工只能看自己录入的成交 */
  DEAL_VIEW_ALL: 'deal:view-all',
  DEAL_CREATE: 'deal:create',
  DEAL_AUDIT: 'deal:audit',
  DEAL_SETTLE: 'deal:settle',

  /** 客户线索：查看 / 录入 / 跟进自己的线索（员工、管理员） */
  LEAD_VIEW: 'lead:view',
  LEAD_EDIT: 'lead:edit',
  /** 查看全部线索、分配跟进人、删除线索（仅管理员）；没有该权限只能看自己录入或分给自己的 */
  LEAD_MANAGE: 'lead:manage',

  LOG_VIEW: 'log:view',
  USER_MANAGE: 'user:manage',
} as const;
export type Perm = (typeof PERM)[keyof typeof PERM];

const ALL_PERMS = Object.values(PERM) as Perm[];

export const ROLE_PERMS: Record<Role, readonly Perm[]> = {
  ADMIN: ALL_PERMS.filter((p) => p !== PERM.DASHBOARD_ORG && p !== PERM.MY_ORG),
  /** 员工：机构、成交只读（查看 + 导出）；客户线索可以录入和跟进自己的 */
  STAFF: [
    PERM.DASHBOARD_GLOBAL,
    PERM.ORG_VIEW,
    PERM.ORG_EXPORT,
    PERM.ORG_REVIEW,
    PERM.DEAL_VIEW,
    PERM.LEAD_VIEW,
    PERM.LEAD_EDIT,
  ],
  ORG: [PERM.DASHBOARD_ORG, PERM.MY_ORG, PERM.DEAL_VIEW, PERM.DEAL_CREATE],
};

export function permsOf(role: Role): Perm[] {
  return [...ROLE_PERMS[role]];
}

export function roleHasPerm(role: Role, perm: Perm): boolean {
  return ROLE_PERMS[role].includes(perm);
}
