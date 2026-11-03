import { Role } from './enums';

/**
 * 权限点。后端用 requirePerm() 校验，前端用来控制菜单与按钮。
 * 以后给单个账号追加权限时，只需在 User 上扩展 extraPerms，不改业务代码。
 */
export const PERM = {
  DASHBOARD_GLOBAL: 'dashboard:global',
  DASHBOARD_ORG: 'dashboard:org',

  ORG_VIEW: 'org:view',
  ORG_CREATE: 'org:create',
  ORG_UPDATE: 'org:update',
  ORG_DELETE: 'org:delete',
  ORG_IMPORT: 'org:import',
  ORG_EXPORT: 'org:export',

  MY_ORG: 'my-org:manage',

  DEAL_VIEW: 'deal:view',
  DEAL_CREATE: 'deal:create',
  DEAL_AUDIT: 'deal:audit',
  DEAL_SETTLE: 'deal:settle',

  LOG_VIEW: 'log:view',
  USER_MANAGE: 'user:manage',
} as const;
export type Perm = (typeof PERM)[keyof typeof PERM];

const ALL_PERMS = Object.values(PERM) as Perm[];

export const ROLE_PERMS: Record<Role, readonly Perm[]> = {
  ADMIN: ALL_PERMS.filter((p) => p !== PERM.DASHBOARD_ORG && p !== PERM.MY_ORG),
  STAFF: [
    PERM.DASHBOARD_GLOBAL,
    PERM.ORG_VIEW,
    PERM.ORG_CREATE,
    PERM.ORG_UPDATE,
    PERM.ORG_EXPORT,
    PERM.DEAL_VIEW,
    PERM.DEAL_CREATE,
    PERM.DEAL_AUDIT,
  ],
  ORG: [PERM.DASHBOARD_ORG, PERM.MY_ORG, PERM.DEAL_VIEW, PERM.DEAL_CREATE],
};

export function permsOf(role: Role): Perm[] {
  return [...ROLE_PERMS[role]];
}

export function roleHasPerm(role: Role, perm: Perm): boolean {
  return ROLE_PERMS[role].includes(perm);
}
