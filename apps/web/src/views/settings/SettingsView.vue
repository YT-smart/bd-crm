<script setup lang="ts">
import { h, onMounted, ref } from 'vue';
import { NDataTable, NTabPane, NTabs, type DataTableColumns } from 'naive-ui';
import { Monitor, Moon, Sun } from 'lucide-vue-next';
import { ROLE_LABEL, type LoginLogItem } from '@bdcrm/shared';
import { authApi } from '@/api';
import PasswordForm from '@/components/PasswordForm.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import { useAppStore, type ThemeMode } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { dateTime, shortUA } from '@/utils/format';

const auth = useAuthStore();
const app = useAppStore();

const logs = ref<LoginLogItem[]>([]);
const logsLoading = ref(false);

const THEMES: { value: ThemeMode; label: string; desc: string; icon: typeof Sun }[] = [
  { value: 'light', label: '浅色', desc: '明亮清爽，适合白天办公', icon: Sun },
  { value: 'dark', label: '深色', desc: '降低屏幕亮度，夜间更舒适', icon: Moon },
  { value: 'system', label: '跟随系统', desc: '根据操作系统设置自动切换', icon: Monitor },
];

const columns: DataTableColumns<LoginLogItem> = [
  { title: '时间', key: 'createdAt', width: 170, render: (r) => h('span', { class: 'num' }, dateTime(r.createdAt)) },
  {
    title: '结果',
    key: 'success',
    width: 120,
    render: (r) =>
      h('span', { class: ['pill', r.success ? 'pill-success' : 'pill-danger'] }, r.success ? '成功' : r.reason ?? '失败'),
  },
  { title: 'IP', key: 'ip', width: 150, render: (r) => h('span', { class: 'num' }, r.ip ?? '--') },
  { title: '设备', key: 'userAgent', render: (r) => shortUA(r.userAgent) },
];

async function loadLogs() {
  logsLoading.value = true;
  try {
    logs.value = await authApi.loginLogs();
  } finally {
    logsLoading.value = false;
  }
}

onMounted(loadLogs);
</script>

<template>
  <div class="page settings">
    <div class="card profile rise-in">
      <UserAvatar :name="auth.user?.name ?? ''" :size="56" />
      <div class="profile-meta">
        <div class="profile-name">{{ auth.user?.name }}</div>
        <div class="profile-sub">
          <span class="pill pill-brand plain">{{ auth.user ? ROLE_LABEL[auth.user.role] : '' }}</span>
          <span>{{ auth.user?.username }}</span>
          <span v-if="auth.user?.orgName">· {{ auth.user.orgName }}</span>
        </div>
      </div>
      <dl class="profile-fields">
        <div>
          <dt>手机</dt>
          <dd class="num">{{ auth.user?.phone || '未填写' }}</dd>
        </div>
        <div>
          <dt>邮箱</dt>
          <dd>{{ auth.user?.email || '未填写' }}</dd>
        </div>
        <div>
          <dt>上次登录</dt>
          <dd class="num">{{ dateTime(auth.user?.lastLoginAt) }}</dd>
        </div>
      </dl>
    </div>

    <div class="card body rise-in" style="animation-delay: 60ms">
      <NTabs type="line" size="large" animated pane-style="padding-top: 20px">
        <NTabPane name="password" tab="修改密码">
          <div class="narrow">
            <PasswordForm />
          </div>
        </NTabPane>
        <NTabPane name="appearance" tab="外观">
          <div class="themes">
            <button
              v-for="t in THEMES"
              :id="`settings-theme-${t.value}`"
              :key="t.value"
              class="theme-card"
              :class="{ active: app.themeMode === t.value }"
              @click="app.setThemeMode(t.value)"
            >
              <div class="theme-preview" :data-mode="t.value">
                <span class="tp-side" />
                <span class="tp-main"><i /><i /><i /></span>
              </div>
              <div class="theme-info">
                <component :is="t.icon" :size="16" :stroke-width="1.75" />
                <span class="theme-label">{{ t.label }}</span>
              </div>
              <div class="theme-desc">{{ t.desc }}</div>
            </button>
          </div>
        </NTabPane>
        <NTabPane name="logins" tab="登录记录">
          <p class="hint">最近 10 次登录记录。如发现异常登录，请立即修改密码并联系管理员。</p>
          <NDataTable :columns="columns" :data="logs" :loading="logsLoading" :bordered="false" size="small" />
        </NTabPane>
      </NTabs>
    </div>
  </div>
</template>

<style scoped>
.settings {
  max-width: 960px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.profile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  flex-wrap: wrap;
}
.profile-meta {
  flex: 1;
  min-width: 200px;
}
.profile-name {
  font-size: 18px;
  font-weight: 650;
}
.profile-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  color: var(--text-3);
  font-size: 13px;
}
.profile-fields {
  display: flex;
  gap: 32px;
  margin: 0;
}
.profile-fields dt {
  font-size: 12px;
  color: var(--text-3);
}
.profile-fields dd {
  margin: 2px 0 0;
  font-size: 13px;
}
.body {
  padding: 8px 24px 24px;
}
.narrow {
  max-width: 400px;
}
.hint {
  font-size: 13px;
  color: var(--text-3);
  margin-bottom: 12px;
}
.themes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.theme-card {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  text-align: left;
  cursor: pointer;
  color: var(--text);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.theme-card:hover {
  border-color: var(--border-strong);
}
.theme-card.active {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-soft);
}
.theme-preview {
  display: flex;
  height: 84px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.theme-preview[data-mode='light'] {
  background: #f6f7f9;
  --tp-side: #fafbfc;
  --tp-card: #fff;
  --tp-line: #e6e8ec;
}
.theme-preview[data-mode='dark'] {
  background: #0b0d12;
  --tp-side: #0f1117;
  --tp-card: #13161d;
  --tp-line: #232733;
}
.theme-preview[data-mode='system'] {
  background: linear-gradient(90deg, #f6f7f9 50%, #0b0d12 50%);
  --tp-side: transparent;
  --tp-card: rgba(127, 127, 127, 0.22);
  --tp-line: rgba(127, 127, 127, 0.3);
}
.tp-side {
  width: 28%;
  background: var(--tp-side);
  border-right: 1px solid var(--tp-line);
}
.tp-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 10px;
}
.tp-main i {
  border-radius: 4px;
  background: var(--tp-card);
  border: 1px solid var(--tp-line);
}
.tp-main i:first-child {
  grid-column: span 2;
  background: #3b5bdb;
  opacity: 0.85;
  border: 0;
}
.theme-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  font-weight: 600;
  font-size: 14px;
}
.theme-desc {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-3);
}
@media (max-width: 720px) {
  .themes {
    grid-template-columns: 1fr;
  }
}
</style>
