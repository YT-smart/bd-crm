<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NTabs, NTabPane, NSkeleton, NProgress, useMessage, useDialog } from 'naive-ui';
import { ArrowLeft, Pencil, Trash2, RotateCcw } from 'lucide-vue-next';
import type { OrgDetail } from '@bdcrm/shared';
import { ORG_STATUS_LABEL } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import StatusTag from '@/components/StatusTag.vue';
import OrgOverviewTab from './tabs/OrgOverviewTab.vue';
import OrgInfoTab from './tabs/OrgInfoTab.vue';
import OrgContactsTab from './tabs/OrgContactsTab.vue';
import OrgProductsTab from './tabs/OrgProductsTab.vue';
import OrgCooperationTab from './tabs/OrgCooperationTab.vue';
import OrgDealsTab from './tabs/OrgDealsTab.vue';
import OrgFollowUpsTab from './tabs/OrgFollowUpsTab.vue';
import OrgAttachmentsTab from './tabs/OrgAttachmentsTab.vue';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const auth = useAuthStore();

const orgId = computed(() => route.params.id as string);
const org = ref<OrgDetail | null>(null);
const loading = ref(true);
const activeTab = ref('overview');

async function loadOrg() {
  loading.value = true;
  try {
    org.value = await orgApi.detail(orgId.value);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      router.replace('/404');
      return;
    }
    message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadOrg);

function handleDelete() {
  if (!org.value) return;
  dialog.warning({
    title: '删除确认',
    content: `确定删除机构"${org.value.name}"吗？删除后该机构所有账号将被停用。此操作不可撤销。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await orgApi.remove(orgId.value);
        message.success('机构已删除');
        router.replace('/orgs');
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : '删除失败');
      }
    },
  });
}

const canEdit = computed(() => auth.can('org:update'));
const canDelete = computed(() => auth.can('org:delete'));
</script>

<template>
  <div class="page">
    <!-- 顶部导航 -->
    <div class="card header rise-in">
      <div class="header-top">
        <button class="link-btn back" @click="router.push('/orgs')">
          <ArrowLeft :size="16" :stroke-width="1.75" /> 合作机构
        </button>
        <div v-if="org && !loading" class="header-actions">
          <button v-if="canEdit" id="org-edit" class="btn btn-ghost btn-sm" @click="activeTab = 'info'">
            <Pencil :size="14" :stroke-width="1.75" /> 编辑资料
          </button>
          <button v-if="canDelete" id="org-delete" class="btn btn-danger-ghost btn-sm" @click="handleDelete">
            <Trash2 :size="14" :stroke-width="1.75" /> 删除
          </button>
        </div>
      </div>

      <div v-if="loading" class="header-skeleton">
        <NSkeleton :width="200" :height="28" :sharp="false" />
        <NSkeleton :width="300" :height="18" :sharp="false" style="margin-top: 8px" />
      </div>

      <div v-else-if="org" class="header-info">
        <div class="name-row">
          <h1 class="org-name">{{ org.name }}</h1>
          <StatusTag kind="org" :status="org.status" />
          <span v-if="org.level" :class="['level', `level-${org.level}`]">{{ org.level }}</span>
        </div>
        <div class="meta-row">
          <span v-if="org.province || org.city" class="meta-item">
            总部: {{ [org.province, org.city].filter(Boolean).join(' ') }}
          </span>
          <span class="meta-item">佣金: {{ org.defaultRate }}%</span>
        </div>
        <div class="completeness-row">
          <span class="text-3 completeness-label">资料完整度</span>
          <NProgress
            type="line"
            :percentage="org.completeness"
            :show-indicator="false"
            :height="5"
            rail-color="var(--neutral-soft)"
            :color="org.completeness < 40 ? 'var(--danger)' : org.completeness < 70 ? 'var(--warning)' : 'var(--brand)'"
            style="width: 200px"
          />
          <span class="num text-3">{{ org.completeness }}%</span>
          <span v-if="org.missing.length" class="text-3 missing">
            待完善: {{ org.missing.join('、') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Tab 内容 -->
    <div v-if="org && !loading" class="card tabs-card rise-in" style="animation-delay: 60ms">
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="overview" tab="概览">
          <OrgOverviewTab :org="org" @refresh="loadOrg" @navigate="(t) => (activeTab = t)" />
        </NTabPane>
        <NTabPane name="info" tab="基本资料">
          <OrgInfoTab :org="org" :can-edit="canEdit" @updated="loadOrg" />
        </NTabPane>
        <NTabPane name="contacts" tab="联系人">
          <OrgContactsTab :org-id="org.id" :contacts="org.contacts" :can-edit="canEdit" @refresh="loadOrg" />
        </NTabPane>
        <NTabPane name="products" tab="产品与报价">
          <OrgProductsTab
            :org-id="org.id"
            :products="org.products"
            :default-rate="org.defaultRate"
            :can-edit="canEdit"
            @refresh="loadOrg"
          />
        </NTabPane>
        <NTabPane name="cooperation" tab="合作信息">
          <OrgCooperationTab :org="org" :can-edit="canEdit" @updated="loadOrg" />
        </NTabPane>
        <NTabPane name="deals" tab="成交记录">
          <OrgDealsTab :org-id="org.id" :stats="org.stats" />
        </NTabPane>
        <NTabPane name="attachments" tab="附件资料">
          <OrgAttachmentsTab :org-id="org.id" :can-edit="canEdit" />
        </NTabPane>
        <NTabPane name="follow-ups" tab="跟进记录">
          <OrgFollowUpsTab :org-id="org.id" :can-edit="canEdit" />
        </NTabPane>
      </NTabs>
    </div>
  </div>
</template>

<style scoped>
.header {
  padding: 20px 24px;
}
.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.header-skeleton {
  padding: 4px 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.org-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
}
.level {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
.level-A { background: var(--brand-soft); color: var(--brand); }
.level-B { background: var(--info-soft); color: var(--info); }
.level-C { background: var(--neutral-soft); color: var(--text-2); }
.meta-row {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  color: var(--text-2);
  font-size: 13px;
}
.meta-item::before {
  content: '';
  display: none;
}
.meta-item + .meta-item::before {
  display: inline;
  content: '·';
  margin-right: 16px;
  color: var(--text-3);
}
.completeness-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.completeness-label {
  font-size: 12px;
}
.missing {
  font-size: 12px;
  color: var(--warning);
}
.tabs-card {
  margin-top: 12px;
  padding: 0 24px 24px;
}
.tabs-card :deep(.n-tabs-nav) {
  padding-top: 12px;
}
.tabs-card :deep(.n-tab-pane) {
  padding-top: 16px;
}
</style>
