<script setup lang="ts">
import { h } from 'vue';
import { useRouter } from 'vue-router';
import { NDataTable, type DataTableColumns } from 'naive-ui';
import { ArrowRight } from 'lucide-vue-next';
import type { DealBrief } from '@bdcrm/shared';
import StatusTag from '@/components/StatusTag.vue';
import { date, money } from '@/utils/format';

withDefaults(
  defineProps<{
    title: string;
    sub?: string;
    data: DealBrief[];
    loading?: boolean;
    /** 是否显示机构列（机构视图下不需要） */
    showOrg?: boolean;
  }>(),
  { showOrg: true, sub: undefined, loading: false },
);

const router = useRouter();

function columns(showOrg: boolean): DataTableColumns<DealBrief> {
  const cols: DataTableColumns<DealBrief> = [
    { title: '学生', key: 'studentName', width: 90, ellipsis: { tooltip: true } },
    {
      title: '成交金额',
      key: 'amount',
      align: 'right',
      width: 130,
      render: (r) => h('span', { class: 'num' }, money(r.amount)),
    },
    {
      title: '佣金',
      key: 'commission',
      align: 'right',
      width: 120,
      render: (r) => h('span', { class: 'num' }, money(r.commission)),
    },
    { title: '成交日期', key: 'dealAt', width: 120, render: (r) => h('span', { class: 'num text-2', style: 'white-space: nowrap' }, date(r.dealAt)) },
    { title: '状态', key: 'status', width: 96, render: (r) => h(StatusTag, { kind: 'deal', status: r.status }) },
  ];
  if (showOrg) {
    cols.unshift({ title: '机构', key: 'orgName', ellipsis: { tooltip: true }, minWidth: 140 });
  }
  return cols;
}
</script>

<template>
  <div class="card deal-card">
    <div class="card-header">
      <div>
        <div class="card-title">{{ title }}</div>
        <div v-if="sub" class="card-sub">{{ sub }}</div>
      </div>
      <button class="link-btn" @click="router.push('/deals')">查看全部 <ArrowRight :size="14" /></button>
    </div>
    <div class="table-wrap">
      <NDataTable
        :columns="columns(showOrg)"
        :data="data"
        :loading="loading"
        :bordered="false"
        :single-line="true"
        size="small"
        :row-key="(r: DealBrief) => r.id"
      />
    </div>
  </div>
</template>

<style scoped>
.deal-card {
  overflow: hidden;
}
.table-wrap {
  margin-top: 12px;
}
.table-wrap :deep(.n-data-table-th) {
  font-size: 13px;
}
.table-wrap :deep(.n-data-table-td) {
  height: 48px;
}
</style>
