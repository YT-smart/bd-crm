<script setup lang="ts">
import { ref, reactive, h, onMounted, computed } from 'vue';
import { Plus } from 'lucide-vue-next';
import { NDataTable, NSelect, type DataTableColumns } from 'naive-ui';
import { ACTIVE_DEAL_STATUSES, DealStatus, DEAL_STATUS_LABEL, type DealListItem } from '@bdcrm/shared';
import { dealApi } from '@/api';
import { ApiError } from '@/api/http';
import { useMessage } from 'naive-ui';
import StatusTag from '@/components/StatusTag.vue';
import OrgCard from '../OrgCard.vue';
import DealCreateModal from '@/components/DealCreateModal.vue';
import { useAuthStore } from '@/stores/auth';
import { date, money } from '@/utils/format';

/**
 * 机构的成交记录。管理员看全部；员工只看自己在这家机构录入的（后端按登录身份过滤），
 * 员工和管理员都可以在这里直接录入成交。
 */
const props = defineProps<{ orgId: string; canCreate?: boolean }>();
const auth = useAuthStore();
const isAdmin = computed(() => auth.user?.role === 'ADMIN');
const title = computed(() => (auth.user?.role === 'STAFF' ? '我的成交记录' : '成交记录'));
const showCreate = ref(false);
function onCreated() {
  pagination.page = 1;
  load();
}
const message = useMessage();

const rows = ref<DealListItem[]>([]);
const loading = ref(false);
const status = ref<DealStatus | null>(null);
const pagination = reactive({
  page: 1,
  pageSize: 10,
  itemCount: 0,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
  prefix: ({ itemCount }: { itemCount?: number }) => `共 ${itemCount ?? 0} 笔`,
  onChange: (p: number) => { pagination.page = p; load(); },
  onUpdatePageSize: (s: number) => { pagination.pageSize = s; pagination.page = 1; load(); },
});

const statusOptions = ACTIVE_DEAL_STATUSES.map((k) => ({ label: DEAL_STATUS_LABEL[k], value: k }));

async function load() {
  loading.value = true;
  try {
    const res = await dealApi.list({
      orgId: props.orgId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      status: status.value ?? undefined,
      sort: 'dealAt',
      order: 'desc',
    });
    rows.value = res.list;
    pagination.itemCount = res.total;
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '成交记录加载失败');
  } finally {
    loading.value = false;
  }
}

function onStatusChange() {
  pagination.page = 1;
  load();
}

onMounted(load);

const columns = computed<DataTableColumns<DealListItem>>(() => [
  // 列都只给最小宽度：卡片变宽时多出来的空间平均分给各列，不会集中在某一列留出大片空白
  { title: '成交日期', key: 'dealAt', minWidth: 96, render: (r) => h('span', { class: 'num', style: 'white-space:nowrap' }, date(r.dealAt)) },
  { title: '学员', key: 'studentName', minWidth: 72, ellipsis: { tooltip: true } },
  { title: '产品', key: 'productName', minWidth: 120, ellipsis: { tooltip: true }, render: (r) => r.productName ?? '--' },
  { title: '成交金额', key: 'amount', minWidth: 96, align: 'right', render: (r) => h('span', { class: 'num' }, money(r.amount)) },
  { title: '比例', key: 'rate', minWidth: 60, align: 'right', render: (r) => h('span', { class: 'num text-2' }, `${r.rate}%`) },
  { title: '佣金', key: 'commission', minWidth: 88, align: 'right', render: (r) => h('span', { class: 'num strong' }, money(r.commission)) },
  { title: '状态', key: 'status', minWidth: 84, align: 'center', render: (r) => h(StatusTag, { kind: 'deal', status: r.status }) },
  ...(isAdmin.value ? [{ title: '录入人', key: 'createdByName', minWidth: 72, ellipsis: { tooltip: true } }] : []),
]);
</script>

<template>
  <OrgCard :title="pagination.itemCount ? `${title}（${pagination.itemCount}）` : title">
    <template #extra>
      <button v-if="canCreate" id="org-deal-create" class="btn btn-sm" @click="showCreate = true">
        <Plus :size="14" /> 录入成交
      </button>
      <NSelect
        id="org-deals-status"
        v-model:value="status"
        :options="statusOptions"
        clearable
        placeholder="全部状态"
        size="small"
        style="width: 130px"
        @update:value="onStatusChange"
      />
    </template>

    <NDataTable
      remote
      :columns="columns"
      :data="rows"
      :loading="loading"
      :pagination="pagination"
      :row-key="(r: DealListItem) => r.id"
      :scroll-x="isAdmin ? 670 : 600"
      size="small"
    />
    <DealCreateModal v-model:show="showCreate" :org-id="orgId" @created="onCreated" />
  </OrgCard>
</template>

<style scoped>
:deep(.strong) { font-weight: 600; }
:deep(.n-data-table-th),
:deep(.n-data-table-td) { padding-left: 8px; padding-right: 8px; }
</style>
