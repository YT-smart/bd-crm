<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { NSkeleton, NTabs, NTabPane, NProgress, useMessage } from 'naive-ui';
import type { OrgDetail } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import OrgOverviewTab from './tabs/OrgOverviewTab.vue';
import OrgInfoTab from './tabs/OrgInfoTab.vue';
import OrgContactsTab from './tabs/OrgContactsTab.vue';
import OrgProductsTab from './tabs/OrgProductsTab.vue';
import OrgAttachmentsTab from './tabs/OrgAttachmentsTab.vue';
import OrgDealsTab from './tabs/OrgDealsTab.vue';

const message = useMessage();
const auth = useAuthStore();
const orgId = computed(() => auth.user?.orgId ?? '');

const org = ref<OrgDetail | null>(null);
const loading = ref(true);
const activeTab = ref('overview');

async function loadOrg() {
  if (!orgId.value) return;
  loading.value = true;
  try {
    org.value = await orgApi.detail(orgId.value);
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadOrg);
</script>

<template>
  <div class="page">
    <div class="card rise-in" style="padding: 20px 24px">
      <h1 class="page-title">我的机构</h1>

      <div v-if="loading" style="padding: 20px 0">
        <NSkeleton :width="240" :height="24" :sharp="false" />
        <NSkeleton :width="400" :height="16" :sharp="false" style="margin-top: 10px" />
      </div>

      <template v-else-if="org">
        <div class="org-header">
          <span class="org-name">{{ org.name }}</span>
          <div class="completeness-row">
            <span class="text-3">资料完整度</span>
            <NProgress
              type="line"
              :percentage="org.completeness"
              :show-indicator="false"
              :height="5"
              rail-color="var(--neutral-soft)"
              :color="org.completeness < 40 ? 'var(--danger)' : org.completeness < 70 ? 'var(--warning)' : 'var(--brand)'"
              style="width: 160px"
            />
            <span class="num text-3">{{ org.completeness }}%</span>
          </div>
          <div v-if="org.missing.length" class="missing text-3">
            待完善: {{ org.missing.join('、') }}
          </div>
        </div>
      </template>
    </div>

    <div v-if="org && !loading" class="card tabs-card rise-in" style="animation-delay: 60ms">
      <NTabs v-model:value="activeTab" type="line" animated>
        <NTabPane name="overview" tab="概览">
          <OrgOverviewTab :org="org" @refresh="loadOrg" @navigate="(t) => (activeTab = t)" />
        </NTabPane>
        <NTabPane name="info" tab="基本资料">
          <OrgInfoTab :org="org" @updated="loadOrg" />
        </NTabPane>
        <NTabPane name="contacts" tab="联系人">
          <OrgContactsTab :org-id="org.id" :contacts="org.contacts" @refresh="loadOrg" />
        </NTabPane>
        <NTabPane name="products" tab="产品与报价">
          <OrgProductsTab :org-id="org.id" :products="org.products" :default-rate="org.defaultRate" @refresh="loadOrg" />
        </NTabPane>
        <NTabPane name="deals" tab="成交记录">
          <OrgDealsTab :org-id="org.id" :stats="org.stats" />
        </NTabPane>
        <NTabPane name="attachments" tab="附件资料">
          <OrgAttachmentsTab :org-id="org.id" :can-edit="true" />
        </NTabPane>
      </NTabs>
    </div>
  </div>
</template>

<style scoped>
.page-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 16px;
}
.org-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.org-name {
  font-size: 18px;
  font-weight: 600;
}
.completeness-row {
  display: flex;
  align-items: center;
  gap: 8px;
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
