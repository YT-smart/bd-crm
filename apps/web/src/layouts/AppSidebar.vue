<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NPopover, NTooltip, useDialog } from 'naive-ui';
import { ChevronsUpDown, LogOut, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Settings, Sun } from 'lucide-vue-next';
import { ROLE_LABEL } from '@bdcrm/shared';
import LogoMark from '@/components/LogoMark.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAppStore, type ThemeMode } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { NAV_ITEMS } from './nav';

const app = useAppStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const dialog = useDialog();

const items = computed(() => NAV_ITEMS.filter((i) => auth.can(i.perm)));
const collapsed = computed(() => app.sidebarCollapsed);

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`);
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '系统', icon: Monitor },
];

function confirmLogout() {
  dialog.warning({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    positiveText: '退出',
    negativeText: '取消',
    onPositiveClick: async () => {
      await auth.logout();
      router.replace('/login');
    },
  });
}
</script>

<template>
  <aside class="sidebar" :class="{ collapsed }">
    <div class="brand">
      <LogoMark :size="28" />
      <span v-show="!collapsed" class="brand-name">BD-CRM</span>
    </div>

    <nav class="nav" aria-label="主导航">
      <template v-for="item in items" :key="item.key">
        <NTooltip placement="right" :disabled="!collapsed" :show-arrow="false">
          <template #trigger>
            <RouterLink :id="`nav-${item.key}`" :to="item.to" class="nav-item" :class="{ active: isActive(item.to) }">
              <component :is="item.icon" :size="18" :stroke-width="1.75" class="nav-icon" />
              <span v-show="!collapsed" class="nav-label">{{ item.label }}</span>
            </RouterLink>
          </template>
          {{ item.label }}
        </NTooltip>
      </template>
    </nav>

    <div class="sidebar-foot">
      <button
        id="sidebar-toggle"
        class="collapse-btn"
        :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="app.toggleSidebar()"
      >
        <component :is="collapsed ? PanelLeftOpen : PanelLeftClose" :size="16" :stroke-width="1.75" />
        <span v-show="!collapsed">收起</span>
      </button>

      <NPopover trigger="click" placement="top-start" :show-arrow="false" raw class="user-pop-wrap">
        <template #trigger>
          <button id="user-menu-trigger" class="user-block">
            <UserAvatar :name="auth.user?.name ?? ''" :size="32" />
            <span v-show="!collapsed" class="user-meta">
              <span class="user-name ellipsis">{{ auth.user?.name }}</span>
              <span class="user-role ellipsis">
                {{ auth.user ? ROLE_LABEL[auth.user.role] : '' }}{{ auth.user?.orgName ? ` · ${auth.user.orgName}` : '' }}
              </span>
            </span>
            <ChevronsUpDown v-show="!collapsed" :size="14" class="user-caret" />
          </button>
        </template>

        <div class="user-pop">
          <div class="pop-head">
            <UserAvatar :name="auth.user?.name ?? ''" :size="36" />
            <div class="pop-head-meta">
              <div class="pop-name">{{ auth.user?.name }}</div>
              <div class="pop-sub">{{ auth.user?.username }}</div>
            </div>
          </div>
          <div class="pop-sep" />
          <RouterLink id="menu-settings" to="/settings" class="pop-item">
            <Settings :size="16" :stroke-width="1.75" />
            个人设置
          </RouterLink>
          <div class="pop-theme">
            <span class="pop-theme-label">外观</span>
            <div class="segmented small">
              <button
                v-for="t in THEME_OPTIONS"
                :id="`theme-${t.value}`"
                :key="t.value"
                :class="{ active: app.themeMode === t.value }"
                :title="t.label"
                @click="app.setThemeMode(t.value)"
              >
                <component :is="t.icon" :size="14" :stroke-width="1.75" />
              </button>
            </div>
          </div>
          <div class="pop-sep" />
          <button id="menu-logout" class="pop-item danger" @click="confirmLogout">
            <LogOut :size="16" :stroke-width="1.75" />
            退出登录
          </button>
        </div>
      </NPopover>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  width: var(--sidebar-w);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-subtle);
  border-right: 1px solid var(--border);
  transition: width 0.22s var(--ease);
  z-index: 10;
}
.sidebar.collapsed {
  width: var(--sidebar-w-collapsed);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--header-h);
  padding: 0 18px;
}
.brand-name {
  font-weight: 700;
  font-size: 16px;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  overflow-y: auto;
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 38px;
  padding: 0 12px;
  border-radius: var(--radius);
  color: var(--text-2);
  font-size: 14px;
  white-space: nowrap;
  transition: background-color 0.15s, color 0.15s;
}
.nav-item:hover {
  background: var(--neutral-soft);
  color: var(--text);
}
.nav-item.active {
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 500;
}
.nav-icon {
  flex-shrink: 0;
}
.collapsed .nav-item {
  justify-content: center;
  padding: 0;
}

.sidebar-foot {
  border-top: 1px solid var(--border);
  padding: 8px 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.collapse-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-3);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}
.collapse-btn:hover {
  color: var(--text);
  background: var(--neutral-soft);
}
.collapsed .collapse-btn {
  justify-content: center;
  padding: 0;
}

.user-block {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: var(--text);
  transition: background-color 0.15s;
}
.user-block:hover {
  background: var(--neutral-soft);
}
.collapsed .user-block {
  justify-content: center;
  padding: 8px 0;
}
.user-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.user-name {
  font-size: 14px;
  font-weight: 600;
}
.user-role {
  font-size: 12px;
  color: var(--text-3);
}
.user-caret {
  color: var(--text-3);
  flex-shrink: 0;
}

.user-pop {
  width: 240px;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-pop);
}
.pop-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 10px;
}
.pop-head-meta {
  min-width: 0;
}
.pop-name {
  font-weight: 600;
  color: var(--text);
}
.pop-sub {
  font-size: 12px;
  color: var(--text-3);
}
.pop-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}
.pop-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.pop-item:hover {
  background: var(--neutral-soft);
}
.pop-item.danger {
  color: var(--danger);
}
.pop-theme {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 4px 0 10px;
  font-size: 13px;
  color: var(--text);
}
.segmented.small button {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
}
</style>
