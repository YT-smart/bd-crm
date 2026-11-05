import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { PERM, type Perm } from '@bdcrm/shared';
import { useAuthStore } from '@/stores/auth';
import BasicLayout from '@/layouts/BasicLayout.vue';

declare module 'vue-router' {
  interface RouteMeta {
    title?: string;
    /** 无需登录 */
    public?: boolean;
    /** 需要的权限点（满足其一） */
    perm?: Perm | Perm[];
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/force-password',
    name: 'force-password',
    component: () => import('@/views/auth/ForcePasswordView.vue'),
    meta: { title: '修改初始密码' },
  },
  {
    path: '/',
    component: BasicLayout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: { title: '仪表盘' },
      },
      {
        path: 'orgs',
        name: 'orgs',
        component: () => import('@/views/orgs/OrgListView.vue'),
        meta: { title: '合作机构', perm: PERM.ORG_VIEW },
      },
      {
        path: 'orgs/:id',
        name: 'org-detail',
        component: () => import('@/views/orgs/OrgDetailView.vue'),
        meta: { title: '机构详情', perm: PERM.ORG_VIEW },
      },
      {
        path: 'my-org',
        name: 'my-org',
        component: () => import('@/views/orgs/MyOrgView.vue'),
        meta: { title: '我的机构', perm: PERM.MY_ORG },
      },
      {
        path: 'deals',
        name: 'deals',
        component: () => import('@/views/deals/DealListView.vue'),
        meta: { title: '成交与结算', perm: PERM.DEAL_VIEW },
      },
      {
        path: 'logs',
        name: 'logs',
        component: () => import('@/views/logs/AuditLogView.vue'),
        meta: { title: '操作日志', perm: PERM.LOG_VIEW },
      },
      {
        path: 'users',
        name: 'users',
        component: () => import('@/views/users/UserManageView.vue'),
        meta: { title: '账号管理', perm: PERM.USER_MANAGE },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/settings/SettingsView.vue'),
        meta: { title: '个人设置' },
      },
      {
        path: '403',
        name: 'forbidden',
        component: () => import('@/views/common/ForbiddenView.vue'),
        meta: { title: '无权访问' },
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/common/NotFoundView.vue'),
        meta: { title: '页面不存在' },
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.restore();

  if (to.meta.public) {
    return auth.isLoggedIn && to.name === 'login' ? { path: '/' } : true;
  }
  if (!auth.isLoggedIn) {
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined };
  }
  if (auth.user!.mustChangePwd) {
    return to.name === 'force-password' ? true : { name: 'force-password' };
  }
  if (to.name === 'force-password') return { path: '/' };
  if (!auth.can(to.meta.perm)) return { name: 'forbidden' };
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} - BD-CRM` : 'BD-CRM 合作机构管理';
});
