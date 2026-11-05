<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NSkeleton, useMessage, useDialog } from 'naive-ui';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-vue-next';
import type { OrgDetail } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import OrgProfile from './OrgProfile.vue';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const auth = useAuthStore();

const orgId = computed(() => route.params.id as string);
const org = ref<OrgDetail | null>(null);
const loading = ref(true);
const profileRef = ref<InstanceType<typeof OrgProfile> | null>(null);

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
    <!-- 顶部操作条：机构名称、状态、完整度等已合并到「基本信息」卡片 -->
    <div class="toolbar">
      <button class="link-btn back" @click="router.push('/orgs')">
        <ArrowLeft :size="16" :stroke-width="1.75" /> 合作机构
      </button>
      <div v-if="org && !loading" class="header-actions">
        <button v-if="canEdit" id="org-edit" class="btn btn-ghost btn-sm" @click="profileRef?.openEdit()">
          <Pencil :size="14" :stroke-width="1.75" /> 编辑资料
        </button>
        <button v-if="canDelete" id="org-delete" class="btn btn-danger-ghost btn-sm" @click="handleDelete">
          <Trash2 :size="14" :stroke-width="1.75" /> 删除
        </button>
      </div>
    </div>

    <div v-if="loading" class="card skeleton-card">
      <NSkeleton text :repeat="6" :sharp="false" />
    </div>

    <OrgProfile v-if="org && !loading" ref="profileRef" :org="org" :can-edit="canEdit" @refresh="loadOrg" />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 32px;
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
.skeleton-card {
  margin-top: 16px;
  padding: 24px;
}
</style>
