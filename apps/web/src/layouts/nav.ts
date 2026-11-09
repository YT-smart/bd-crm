import type { Component } from 'vue';
import { Building2, CircleDollarSign, Contact, FileClock, LayoutDashboard, Store, UserCog } from 'lucide-vue-next';
import { PERM, type Perm } from '@bdcrm/shared';

export interface NavItem {
  key: string;
  label: string;
  icon: Component;
  to: string;
  perm?: Perm | Perm[];
  /** 搜索面板的关键词 */
  keywords?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: '仪表盘', icon: LayoutDashboard, to: '/dashboard', keywords: 'dashboard 首页 数据' },
  { key: 'orgs', label: '合作机构', icon: Building2, to: '/orgs', perm: PERM.ORG_VIEW, keywords: 'org 机构 伙伴' },
  { key: 'my-org', label: '我的机构', icon: Store, to: '/my-org', perm: PERM.MY_ORG, keywords: 'my 资料' },
  { key: 'leads', label: '客户线索', icon: Contact, to: '/leads', perm: PERM.LEAD_VIEW, keywords: 'lead 线索 学生 客户 跟进' },
  { key: 'deals', label: '成交与结算', icon: CircleDollarSign, to: '/deals', perm: PERM.DEAL_VIEW, keywords: 'deal 成交 佣金 结算 对账' },
  { key: 'logs', label: '操作日志', icon: FileClock, to: '/logs', perm: PERM.LOG_VIEW, keywords: 'log 日志 审计' },
  { key: 'users', label: '账号管理', icon: UserCog, to: '/users', perm: PERM.USER_MANAGE, keywords: 'user 账号 员工' },
];
