<script setup lang="ts">
import { ref, reactive, h, onMounted } from 'vue';
import { NDataTable, NSelect, type DataTableColumns } from 'naive-ui';
import { DealStatus, DEAL_STATUS_LABEL, type DealListItem, type OrgStats } from '@bdcrm/shared';
import { dealApi } from '@/api';
import { ApiError } from '@/api/http';
import { useMessage } from 'naive-ui';
import StatusTag from '@/components/StatusTag.vue';
import { date, money } from '@/utils/format';

const props = defineProps<{ orgId: string; stats: OrgStats }>();
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

const statusOptions = (Object.keys(DEAL_STATUS_LABEL) as DealStatus[]).map((k) => ({ label: DEAL_STATUS_LABEL[k], value: k }));

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

const columns: DataTableColumns<DealListItem> = [
  { title: '成交日期', key: 'dealAt', width: 120, render: (r) => h('span', { class: 'num', style: 'white-space:nowrap' }, date(r.dealAt)) },
  { title: '学员', key: 'studentName', minWidth: 90 },
  { title: '产品', key: 'productName', minWidth: 120, ellipsis: { tooltip: true }, render: (r) => r.productName ?? '--' },
  { title: '成交金额', key: 'amount', width: 120, align: 'right', render: (r) => h('span', { class: 'num' }, money(r.amount)) },
  { title: '佣金比例', key: 'rate', width: 90, align: 'right', render: (r) => h('span', { class: 'num' }, `${r.rate}%`) },
  { title: '佣金', key: 'commission', width: 110, align: 'right', render: (r) => h('span', { class: 'num strong' }, money(r.commission)) },
  { title: '状态', key: 'status', width: 96, render: (r) => h(StatusTag, { kind: 'deal', status: r.status }) },
  { title: '录入人', key: 'createdByName', width: 90 },
];
</script>

<template>
  <div>
    <div class="stats-row">
      <div class="mini-stat">
        <div class="mini-label text-3">总成交</div>
        <div class="mini-value">{{ stats.dealCount }} <span class="text-3 unit">笔</span></div>
      </div>
      <div class="mini-stat">
        <div class="mini-label text-3">成交总额</div>
        <div class="mini-value">{{ money(stats.dealAmount) }}</div>
      </div>
      <div class="mini-stat">
        <div class="mini-label text-3">累计佣金</div>
        <div class="mini-value brand">{{ money(stats.commission) }}</div>
      </div>
      <div class="mini-stat">
        <div class="mini-label text-3">已结算</div>
        <div class="mini-value success">{{ money(stats.settled) }}</div>
      </div>
      <div class="mini-stat">
        <div class="mini-label text-3">未结算</div>
        <div class="mini-value warning">{{ money(stats.unsettled) }}</div>
      </div>
      <div class="mini-stat">
        <div class="mini-label text-3">待审核</div>
        <div class="mini-value">{{ stats.pendingAudit }} <span class="text-3 unit">笔</span></div>
      </div>
    </div>

    <div class="list-header">
      <span class="section-title">成交明细</span>
      <NSelect
        id="org-deals-status"
        v-model:value="status"
        :options="statusOptions"
        clearable
        placeholder="全部状态"
        size="small"
        style="width: 140px"
        @update:value="onStatusChange"
      />
    </div>

    <NDataTable
      remote
      :columns="columns"
      :data="rows"
      :loading="loading"
      :pagination="pagination"
      :row-key="(r: DealListItem) => r.id"
      :scroll-x="820"
      size="small"
    />
  </div>
</template>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.mini-stat {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.mini-label {
  font-size: 12px;
  margin-bottom: 4px;
}
.mini-value {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.mini-value .unit { font-size: 12px; font-weight: 400; }
.mini-value.brand { color: var(--brand); }
.mini-value.success { color: var(--success); }
.mini-value.warning { color: var(--warning); }
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
:deep(.strong) { font-weight: 600; }
</style>
