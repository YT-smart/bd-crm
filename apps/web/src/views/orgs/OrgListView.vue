<script setup lang="ts">
import { computed, h, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NDataTable, NInput, NSelect, useMessage, type DataTableColumns, type DataTableSortState } from 'naive-ui';
import { useDebounceFn } from '@vueuse/core';
import { Download, MapPin, Plus, RotateCcw, Search, X } from 'lucide-vue-next';
import {
  ORG_LEVELS,
  ORG_STATUS_LABEL,
  PROVINCES,
  isProvince,
  shortProvinceName,
  type OrgListItem,
  type OrgListQuery,
  type OrgStatus,
} from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import StatusTag from '@/components/StatusTag.vue';
import { date, num } from '@/utils/format';
import OrgCreateDrawer from './OrgCreateDrawer.vue';

const route = useRoute();
const router = useRouter();
const message = useMessage();
const auth = useAuthStore();

/* ---------- 筛选状态与 URL 同步（地图点击会带 ?province=） ---------- */
function fromQuery() {
  const q = route.query;
  const s = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : undefined);
  const province = s('province');
  const status = s('status');
  const level = s('level');
  return {
    keyword: s('keyword') ?? '',
    province: province && isProvince(province) ? province : null,
    status: status && status in ORG_STATUS_LABEL ? (status as OrgStatus) : null,
    level: level && (ORG_LEVELS as readonly string[]).includes(level) ? level : null,
    page: Math.max(1, Number(s('page')) || 1),
  };
}

const filters = reactive(fromQuery());
const pageSize = ref(20);
const sort = ref<{ key: OrgListQuery['sort']; order: 'asc' | 'desc' } | null>(null);

const rows = ref<OrgListItem[]>([]);
const total = ref(0);
const loading = ref(false);
const showCreate = ref(false);

const provinceOptions = PROVINCES.map((p) => ({ label: shortProvinceName(p), value: p }));
const statusOptions = (Object.keys(ORG_STATUS_LABEL) as OrgStatus[]).map((k) => ({ label: ORG_STATUS_LABEL[k], value: k }));
const levelOptions = ORG_LEVELS.map((l) => ({ label: `${l} 级`, value: l }));

const hasFilter = computed(() => !!(filters.keyword || filters.province || filters.status || filters.level));
const canCreate = computed(() => auth.can('org:create'));
const canExport = computed(() => auth.can('org:export'));

function syncUrl() {
  router.replace({
    query: {
      keyword: filters.keyword || undefined,
      province: filters.province ?? undefined,
      status: filters.status ?? undefined,
      level: filters.level ?? undefined,
      page: filters.page > 1 ? String(filters.page) : undefined,
    },
  });
}

let seq = 0;
async function load() {
  const my = ++seq;
  loading.value = true;
  try {
    const res = await orgApi.list({
      page: filters.page,
      pageSize: pageSize.value,
      keyword: filters.keyword || undefined,
      province: filters.province ?? undefined,
      status: filters.status ?? undefined,
      level: filters.level ?? undefined,
      sort: sort.value?.key,
      order: sort.value?.order,
    });
    if (my !== seq) return;
    rows.value = res.list;
    total.value = res.total;
  } catch (e) {
    if (my === seq) message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    if (my === seq) loading.value = false;
  }
}

const debouncedKeyword = useDebounceFn(() => {
  filters.page = 1;
  syncUrl();
  load();
}, 300);

watch(() => filters.keyword, debouncedKeyword);
watch(
  () => [filters.province, filters.status, filters.level],
  () => {
    filters.page = 1;
    syncUrl();
    load();
  },
);

// 从其他页面（如地图 / 全局搜索）再次进入时，同步 URL 中的筛选
watch(
  () => route.query,
  () => {
    if (route.name !== 'orgs') return;
    const next = fromQuery();
    if (
      next.keyword !== filters.keyword ||
      next.province !== filters.province ||
      next.status !== filters.status ||
      next.level !== filters.level
    ) {
      Object.assign(filters, next);
    }
  },
);

load();

function reset() {
  Object.assign(filters, { keyword: '', province: null, status: null, level: null, page: 1 });
}

function onPage(p: number) {
  filters.page = p;
  syncUrl();
  load();
}
function onPageSize(s: number) {
  pageSize.value = s;
  filters.page = 1;
  syncUrl();
  load();
}
function onSorter(s: DataTableSortState | null) {
  sort.value = s && s.order ? { key: s.columnKey as OrgListQuery['sort'], order: s.order === 'ascend' ? 'asc' : 'desc' } : null;
  load();
}

function goDetail(row: OrgListItem) {
  router.push(`/orgs/${row.id}`);
}

async function handleExport() {
  try {
    const data = await orgApi.exportData({
      keyword: filters.keyword || undefined,
      province: filters.province ?? undefined,
      status: filters.status ?? undefined,
      level: filters.level ?? undefined,
    });
    // 使用 SheetJS 生成 xlsx（动态导入）
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '合作机构');
    XLSX.writeFile(wb, `合作机构_${date(new Date())}.xlsx`);
    message.success('导出成功');
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '导出失败');
  }
}

function onCreated(id: string) {
  load();
  router.push(`/orgs/${id}`);
}

/* ---------- 表格列 ---------- */
const columns = computed<DataTableColumns<OrgListItem>>(() => [
  {
    title: '机构名称',
    key: 'name',
    width: 260,
    sorter: true,
    sortOrder: sort.value?.key === 'name' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
    render: (r) =>
      h('div', { class: 'org-cell', style: 'cursor: pointer', title: r.name, onClick: () => goDetail(r) }, [
        h('div', { class: 'org-name ellipsis' }, r.name),
        h(
          'div',
          { class: 'org-meta ellipsis' },
          [r.businessTypes.slice(0, 2).join(' / '), ...r.tags.slice(0, 1)].filter(Boolean).join(' · ') || '--',
        ),
      ]),
  },
  {
    title: '地区',
    key: 'region',
    minWidth: 130,
    render: (r) =>
      h('span', { class: 'text-2' }, [r.province ? shortProvinceName(r.province) : '--', r.city && r.city !== shortProvinceName(r.province ?? '') ? ` · ${r.city}` : '']),
  },
  { title: '合作状态', key: 'status', minWidth: 100, align: 'center', render: (r) => h(StatusTag, { kind: 'org', status: r.status }) },
  {
    title: '等级',
    key: 'level',
    minWidth: 80,
    align: 'center',
    sorter: true,
    sortOrder: sort.value?.key === 'level' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
    render: (r) => (r.level ? h('span', { class: `level level-${r.level}` }, r.level) : '--'),
  },
  {
    title: '默认佣金',
    key: 'defaultRate',
    minWidth: 110,
    align: 'center',
    sorter: true,
    sortOrder: sort.value?.key === 'defaultRate' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
    render: (r) => h('span', { class: 'num' }, `${r.defaultRate.toFixed(1)}%`),
  },
  {
    title: '成交笔数',
    key: 'dealCount',
    minWidth: 110,
    align: 'center',
    sorter: true,
    sortOrder: sort.value?.key === 'dealCount' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
    render: (r) => h('span', { class: 'num' }, num(r.dealCount)),
  },
  {
    title: '入驻时间',
    key: 'createdAt',
    minWidth: 130,
    align: 'center',
    sorter: true,
    sortOrder: sort.value?.key === 'createdAt' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
    render: (r) => h('span', { class: 'num text-2', style: 'white-space: nowrap' }, date(r.createdAt)),
  },
]);

const pagination = computed(() => ({
  page: filters.page,
  pageSize: pageSize.value,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
  prefix: () => `共 ${total.value} 家`,
}));
</script>

<template>
  <div class="page">
    <div class="card toolbar rise-in">
      <NInput id="org-search" v-model:value="filters.keyword" placeholder="搜索机构名称、城市（含办公城市）、联系人、电话" clearable class="search">
        <template #prefix><Search :size="16" :stroke-width="1.75" class="text-3" /></template>
      </NInput>
      <NSelect
        id="org-filter-province"
        v-model:value="filters.province"
        :options="provinceOptions"
        placeholder="所在省份"
        clearable
        filterable
        class="sel"
      />
      <NSelect id="org-filter-status" v-model:value="filters.status" :options="statusOptions" placeholder="合作状态" clearable class="sel" />
      <NSelect id="org-filter-level" v-model:value="filters.level" :options="levelOptions" placeholder="机构等级" clearable class="sel sm" />
      <button v-if="hasFilter" id="org-filter-reset" class="link-btn reset" @click="reset">
        <RotateCcw :size="14" /> 重置
      </button>

      <div class="toolbar-right">
        <button v-if="canExport" class="btn btn-ghost btn-sm" @click="handleExport">
          <Download :size="14" /> 导出
        </button>
        <button v-if="canCreate" class="btn btn-sm" @click="showCreate = true">
          <Plus :size="14" /> 新增机构
        </button>
      </div>
    </div>

    <div v-if="filters.province" class="from-map rise-in">
      <MapPin :size="14" :stroke-width="1.75" />
      正在查看 <strong>{{ filters.province }}</strong> 的合作机构
      <button id="clear-province" class="chip-x" aria-label="清除省份筛选" @click="filters.province = null"><X :size="12" /></button>
    </div>

    <div class="card table-card rise-in" style="animation-delay: 60ms">
      <NDataTable
        remote
        :columns="columns"
        :data="rows"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
        :row-key="(r: OrgListItem) => r.id"
        :row-props="(r: OrgListItem) => ({ style: 'cursor: pointer', onClick: () => goDetail(r) })"
        @update:page="onPage"
        @update:page-size="onPageSize"
        @update:sorter="onSorter"
      />
    </div>

    <OrgCreateDrawer v-model:show="showCreate" @created="onCreated" />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  flex-wrap: wrap;
}
.search {
  flex: 1;
  min-width: 240px;
  max-width: 420px;
}
.sel {
  width: 160px;
}
.sel.sm {
  width: 130px;
}
.reset {
  margin-left: 4px;
}
.toolbar-right {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.from-map {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 6px 8px 6px 12px;
  border-radius: 999px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 13px;
}
.from-map strong {
  font-weight: 600;
}
.chip-x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 4px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.chip-x:hover {
  background: var(--brand-soft-2);
}
.table-card {
  margin-top: 12px;
  overflow: hidden;
}
.table-card :deep(.n-data-table-td) {
  height: 56px;
}
.table-card :deep(.n-data-table__pagination) {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  margin: 0;
}
:deep(.org-cell) {
  line-height: 1.35;
  max-width: 228px;
}
:deep(.org-name) {
  font-weight: 500;
  color: var(--brand);
}
:deep(.org-name:hover) {
  text-decoration: underline;
}
:deep(.org-meta) {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
}
:deep(.level) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
:deep(.level-A) {
  background: var(--brand-soft);
  color: var(--brand);
}
:deep(.level-B) {
  background: var(--info-soft);
  color: var(--info);
}
:deep(.level-C) {
  background: var(--neutral-soft);
  color: var(--text-2);
}
:deep(.complete) {
  display: flex;
  align-items: center;
  gap: 8px;
}
:deep(.complete-val) {
  font-size: 12px;
  color: var(--text-3);
  width: 34px;
  text-align: right;
  flex-shrink: 0;
}
</style>
