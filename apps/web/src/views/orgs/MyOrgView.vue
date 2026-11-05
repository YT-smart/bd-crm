<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { NSkeleton, useMessage } from 'naive-ui';
import type { OrgDetail } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import OrgProfile from './OrgProfile.vue';

const message = useMessage();
const auth = useAuthStore();
const orgId = computed(() => auth.user?.orgId ?? '');

const org = ref<OrgDetail | null>(null);
const loading = ref(true);

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
    <h1 class="page-title">我的机构</h1>

    <div v-if="loading" class="card skeleton-card">
      <NSkeleton text :repeat="6" :sharp="false" />
    </div>

    <OrgProfile v-if="org && !loading" :org="org" :can-edit="true" :internal="false" @refresh="loadOrg" />
  </div>
</template>

<style scoped>
.page-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}
.skeleton-card {
  margin-top: 16px;
  padding: 24px;
}
</style>
