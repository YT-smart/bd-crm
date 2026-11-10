<script setup lang="ts">
import { computed, h, reactive, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NDataTable, NInput, NDatePicker, NModal,
  NForm, NFormItem, useMessage, useDialog,
  type DataTableColumns, type DataTableRowKey,
} from 'naive-ui';
import { useDebounceFn } from '@vueuse/core';
import { Download, Plus, RotateCcw, Search, Wallet, Lock } from 'lucide-vue-next';
import {
  DealStatus, DEAL_STATUS_LABEL, PERM,
  type DealListItem, type DealListQuery, type DealSummary,
} from '@bdcrm/shared';
import { dealApi } from '@/api';
import { ApiError } from '@/api/http';
import DealCreateModal from '@/components/DealCreateModal.vue';
import FilterRow, { type FilterOption } from '@/components/FilterRow.vue';
import { useAuthStore } from '@/stores/auth';
import StatusTag from '@/components/StatusTag.vue';
import { date, money, num } from '@/utils/format';

const router = useRouter();
const route = useRoute();
const message = useMessage();
const dialog = useDialog();
const auth = useAuthStore();

/* ---------- 权限 ---------- */
const canCreate = computed(() => auth.can('deal:create'));
/** 确认到账（= 结算）：管理员 */
const canSettle = computed(() => auth.can('deal:settle'));

/** 员工只能看自己录入的成交，管理员看全部，机构账号看本机构 */
const ownOnly = computed(() => auth.user?.role === 'STAFF' && !auth.can(PERM.DEAL_VIEW_ALL));

/* ---------- 筛选 ---------- */
type Preset = 'today' | 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'year';
const DATE_PRESETS: FilterOption[] = [
  { label: '今天', value: 'today' },
  { label: '昨天', value: 'yesterday' },
  { label: '本周', value: 'week' },
  { label: '上周', value: 'lastWeek' },
  { label: '本月', value: 'month' },
  { label: '上月', value: 'lastMonth' },
  { label: '今年', value: 'year' },
];
/** 快捷日期 → [开始, 结束]（含当天，按本地时间） */
function presetRange(p: Preset): [Date, Date] {
  const now = new Date();
  const d = (y: number, m: number, day: number) => new Date(y, m, day);
  const y = now.getFullYear(), m = now.getMonth(), t = now.getDate();
  const dow = (now.getDay() + 6) % 7; // 周一 = 0
  switch (p) {
    case 'today': return [d(y, m, t), d(y, m, t)];
    case 'yesterday': return [d(y, m, t - 1), d(y, m, t - 1)];
    case 'week': return [d(y, m, t - dow), d(y, m, t)];
    case 'lastWeek': return [d(y, m, t - dow - 7), d(y, m, t - dow - 1)];
    case 'month': return [d(y, m, 1), d(y, m, t)];
    case 'lastMonth': return [d(y, m - 1, 1), d(y, m, 0)];
    case 'year': return [d(y, 0, 1), d(y, m, t)];
  }
}

const filters = reactive({
  keyword: '',
  status: null as DealStatus | null,
  datePreset: null as Preset | null,
  /** 自定义日期范围（和快捷日期二选一） */
  dateRange: rangeFromQuery(),
  page: 1,
});

/** 仪表盘「今日 / 本周 / 本月成交」跳转过来时带 ?start=YYYY-MM-DD&end=YYYY-MM-DD */
function rangeFromQuery(): [number, number] | null {
  const { start, end } = route.query;
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof start !== 'string' || typeof end !== 'string' || !re.test(start) || !re.test(end)) return null;
  return [new Date(`${start}T00:00:00`).getTime(), new Date(`${end}T00:00:00`).getTime()];
}

/** 当前生效的日期范围 */
const activeRange = computed<[string, string] | null>(() => {
  if (filters.datePreset) {
    const [a, b] = presetRange(filters.datePreset);
    return [date(a), date(b)];
  }
  return filters.dateRange ? [date(filters.dateRange[0]), date(filters.dateRange[1])] : null;
});

const sort = ref<{ key: DealListQuery['sort']; order: 'asc' | 'desc' } | null>(null);

/** 列表、统计、导出共用的查询条件 */
function query(): DealListQuery {
  return {
    keyword: filters.keyword || undefined,
    status: filters.status ?? undefined,
    startDate: activeRange.value?.[0],
    endDate: activeRange.value?.[1],
    sort: sort.value?.key,
    order: sort.value?.order,
  };
}

/* ---------- 顶部统计（跟随筛选） ---------- */
const summary = ref<DealSummary | null>(null);
let sumSeq = 0;
async function loadSummary() {
  const my = ++sumSeq;
  try {
    const r = await dealApi.summary(query());
    if (my === sumSeq) summary.value = r;
  } catch {
    /* 统计失败不影响列表 */
  }
}

/* ---------- 筛选面板的几行 ---------- */
const statusOptions = computed<FilterOption[]>(() => [
  { label: '待到账', value: DealStatus.PENDING_PAYMENT, count: summary.value?.byStatus[DealStatus.PENDING_PAYMENT] ?? 0 },
  { label: '已结算', value: DealStatus.SETTLED, count: summary.value?.byStatus[DealStatus.SETTLED] ?? 0 },
]);
const statusRow = computed({
  get: () => (filters.status ? [filters.status] : []),
  set: (v: string[]) => { filters.status = (v[0] as DealStatus) ?? null; },
});
const dateRow = computed({
  get: () => (filters.datePreset ? [filters.datePreset] : []),
  set: (v: string[]) => {
    filters.datePreset = (v[0] as Preset) ?? null;
    if (filters.datePreset) filters.dateRange = null;
  },
});
/** 自定义日期：选了就取消快捷日期 */
function onPickRange(v: [number, number] | null) {
  filters.dateRange = v;
  if (v) filters.datePreset = null;
}

const SORT_OPTIONS: FilterOption[] = [
  { label: '成交日期最新', value: 'dealAt:desc' },
  { label: '成交日期最早', value: 'dealAt:asc' },
  { label: '成交额从高到低', value: 'amount:desc' },
  { label: '成交额从低到高', value: 'amount:asc' },
  { label: '佣金从高到低', value: 'commission:desc' },
  { label: '佣金从低到高', value: 'commission:asc' },
  { label: '录入时间最早', value: 'createdAt:asc' },
];
const sortRow = computed({
  get: () => (sort.value ? [`${sort.value.key}:${sort.value.order}`] : []),
  set: (v: string[]) => {
    const [key, order] = (v[0] ?? '').split(':');
    sort.value = v[0] ? { key: key as DealListQuery['sort'], order: order as 'asc' | 'desc' } : null;
    filters.page = 1;
    load();
  },
});

/* ---------- 列表 ---------- */
const pageSize = ref(20);
const rows = ref<DealListItem[]>([]);
const total = ref(0);
const loading = ref(false);
const checkedKeys = ref<DataTableRowKey[]>([]);

let seq = 0;
async function load() {
  const my = ++seq;
  loading.value = true;
  try {
    const res = await dealApi.list({ ...query(), page: filters.page, pageSize: pageSize.value });
    if (my !== seq) return;
    rows.value = res.list;
    total.value = res.total;
  } catch (e) {
    if (my === seq) message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    if (my === seq) loading.value = false;
  }
}

async function reload() { await Promise.all([load(), loadSummary()]); }

const debouncedKeyword = useDebounceFn(() => { filters.page = 1; reload(); }, 300);
watch(() => filters.keyword, debouncedKeyword);
watch(() => [filters.status, filters.datePreset, filters.dateRange], () => {
  filters.page = 1;
  checkedKeys.value = [];
  reload();
});
// 仪表盘带过来的日期参数只用于首次进入；之后改动日期筛选就去掉，避免刷新又被带回来
watch(() => [filters.dateRange, filters.datePreset], () => {
  if (route.query.start || route.query.end) router.replace({ query: { ...route.query, start: undefined, end: undefined } });
});

function resetFilters() {
  Object.assign(filters, { keyword: '', status: null, datePreset: null, dateRange: null, page: 1 });
  sort.value = null;
  checkedKeys.value = [];
}

function onPage(p: number) { filters.page = p; load(); }
function onPageSize(s: number) { pageSize.value = s; filters.page = 1; load(); }
function onSorter(s: any) {
  sort.value = s && s.order ? { key: s.columnKey, order: s.order === 'ascend' ? 'asc' : 'desc' } : null;
  load();
}

/* ---------- 录入成交 ---------- */
const showCreate = ref(false);
function openCreate() {
  showCreate.value = true;
}

/* ---------- 确认到账（= 结算） ---------- */
const showSettle = ref(false);
const settleIds = ref<string[]>([]);
const settleForm = reactive({
  settledAt: Date.now() as number | null,
  settleNote: '',
});

function openSettle(ids: string[]) {
  if (!ids.length) { message.warning('请先勾选待到账的记录'); return; }
  settleIds.value = ids;
  settleForm.settledAt = Date.now();
  settleForm.settleNote = '';
  showSettle.value = true;
}

async function doSettle() {
  if (!settleForm.settledAt) { message.warning('请选择到账日期'); return; }
  try {
    const r = await dealApi.settle({
      dealIds: settleIds.value,
      settledAt: new Date(settleForm.settledAt).toISOString(),
      settleNote: settleForm.settleNote.trim() || undefined,
    });
    message.success(`已确认到账 ${r.updated} 条`);
    showSettle.value = false;
    checkedKeys.value = [];
    reload();
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '操作失败');
  }
}

/* ---------- 撤销结算 ---------- */
function handleRevoke(row: DealListItem) {
  const revokeReason = ref('');
  dialog.warning({
    title: '撤销到账',
    content: () => h('div', [
      h('p', `确定撤销"${row.studentName}"的到账？将回退为"待到账"。`),
      h(NInput, {
        value: revokeReason.value,
        'onUpdate:value': (v: string) => { revokeReason.value = v; },
        placeholder: '撤销原因（必填）',
        type: 'textarea',
        rows: 2,
      }),
    ]),
    positiveText: '确认撤销',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (!revokeReason.value.trim()) { message.warning('请填写撤销原因'); return false; }
      try {
        await dealApi.revokeSettle(row.id, revokeReason.value);
        message.success('已撤销到账');
        reload();
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : '操作失败');
      }
    },
  });
}

/* ---------- 导出 ---------- */
async function handleExport() {
  try {
    const data = await dealApi.exportData(query());
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '成交记录');
    XLSX.writeFile(wb, `成交记录_${date(new Date())}.xlsx`);
    message.success('导出成功');
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '导出失败');
  }
}

/* ---------- 表格列 ---------- */
const columns = computed<DataTableColumns<DealListItem>>(() => {
  const cols: DataTableColumns<DealListItem> = [];

  // 复选框列：只有待到账的能勾选（批量确认到账）
  if (canSettle.value) {
    cols.push({ type: 'selection', fixed: 'left', disabled: (r) => r.status !== DealStatus.PENDING_PAYMENT });
  }

  cols.push(
    {
      title: '学生姓名',
      key: 'studentName',
      width: 120,
      fixed: 'left',
      render: (r) => h('span', { class: 'text-bold' }, r.studentName),
    },
    {
      title: '机构',
      key: 'orgName',
      width: 180,
      ellipsis: { tooltip: true },
      render: (r) => h('a', {
        class: 'link',
        onClick: (e: Event) => { e.stopPropagation(); router.push(`/orgs/${r.orgId}`); },
      }, r.orgName),
    },
    { title: '产品', key: 'productName', width: 140, ellipsis: { tooltip: true }, render: (r) => r.productName ?? '--' },
    {
      title: '成交日期', key: 'dealAt', width: 110, sorter: true,
      sortOrder: sort.value?.key === 'dealAt' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
      render: (r) => h('span', { class: 'num text-2', style: 'white-space: nowrap' }, date(r.dealAt)),
    },
    {
      title: '成交额', key: 'amount', width: 120, align: 'right', sorter: true,
      sortOrder: sort.value?.key === 'amount' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
      render: (r) => h('span', { class: 'num' }, money(r.amount)),
    },
    { title: '佣金比例', key: 'rate', width: 90, align: 'right', render: (r) => h('span', { class: 'num text-2' }, `${r.rate}%`) },
    {
      title: '佣金', key: 'commission', width: 120, align: 'right', sorter: true,
      sortOrder: sort.value?.key === 'commission' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
      render: (r) => h('span', { class: 'num', style: 'font-weight: 600' }, money(r.commission)),
    },
    { title: '状态', key: 'status', width: 100, render: (r) => h(StatusTag, { kind: 'deal', status: r.status }) },
    { title: '录入人', key: 'createdByName', width: 90, render: (r) => r.createdByName },
    {
      title: '录入时间', key: 'createdAt', width: 110, sorter: true,
      sortOrder: sort.value?.key === 'createdAt' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
      render: (r) => h('span', { class: 'num text-2', style: 'white-space: nowrap' }, date(r.createdAt)),
    },
  );

  // 操作列
  cols.push({
    title: '操作',
    key: 'actions',
    width: 120,
    fixed: 'right',
    render: (r) => {
      const btns: any[] = [];
      if (r.status === DealStatus.PENDING_PAYMENT && canSettle.value) {
        btns.push(h('button', { class: 'link-btn sm', onClick: (e: Event) => { e.stopPropagation(); openSettle([r.id]); } }, '确认到账'));
      }
      if (r.status === DealStatus.SETTLED && canSettle.value) {
        btns.push(h('button', { class: 'link-btn sm text-warning', onClick: (e: Event) => { e.stopPropagation(); handleRevoke(r); } }, '撤销到账'));
      }
      if (!btns.length) return h('span', { class: 'text-3' }, '--');
      return h('div', { style: 'display: flex; gap: 6px; align-items: center' }, btns);
    },
  });

  return cols;
});

const pagination = computed(() => ({
  page: filters.page,
  pageSize: pageSize.value,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
  prefix: () => `共 ${total.value} 条`,
}));

const hasFilter = computed(() => !!(filters.keyword || filters.status || filters.datePreset || filters.dateRange || sort.value));

/* ---------- 初始化 ---------- */
onMounted(async () => {
  await Promise.all([loadSummary(), load()]);
});
</script>

<template>
  <div class="page">
    <div v-if="ownOnly" class="scope-note rise-in">
      <Lock :size="13" :stroke-width="1.75" /> 仅自己可见
    </div>

    <!-- 统计卡片：跟随下面的筛选 -->
    <div class="summary-row rise-in">
      <div class="summary-card">
        <div class="summary-label text-3">成交数量</div>
        <div class="summary-value">{{ num(summary?.count) }}<span class="summary-unit">笔</span></div>
      </div>
      <div class="summary-card">
        <div class="summary-label text-3">签约金额</div>
        <div class="summary-value">{{ money(summary?.amount) }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label text-3">佣金金额</div>
        <div class="summary-value brand">{{ money(summary?.commission) }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label text-3">待结算金额</div>
        <div class="summary-value warning">{{ money(summary?.pendingAmount) }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label text-3">已结算金额</div>
        <div class="summary-value success">{{ money(summary?.settledAmount) }}</div>
      </div>
    </div>

    <!-- 筛选面板 -->
    <div class="card filter-card rise-in" style="animation-delay: 40ms">
      <FilterRow v-model="statusRow" label="状态" :options="statusOptions" single all-label="全部" />
      <FilterRow v-model="dateRow" label="成交日期" :options="DATE_PRESETS" single>
        <NDatePicker
          :value="filters.dateRange"
          type="daterange"
          clearable
          size="small"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          class="date-pick"
          @update:value="onPickRange"
        />
      </FilterRow>
      <FilterRow v-model="sortRow" label="排序" :options="SORT_OPTIONS" single all-label="默认" />
    </div>

    <!-- 工具栏 -->
    <div class="card toolbar rise-in" style="animation-delay: 60ms">
      <NInput v-model:value="filters.keyword" placeholder="搜索学生姓名、机构名" clearable class="search">
        <template #prefix><Search :size="16" :stroke-width="1.75" class="text-3" /></template>
      </NInput>
      <button v-if="hasFilter" class="link-btn reset" @click="resetFilters">
        <RotateCcw :size="14" /> 重置
      </button>

      <div class="toolbar-right">
        <template v-if="checkedKeys.length > 0">
          <span class="text-2">已选 {{ checkedKeys.length }} 条</span>
          <button v-if="canSettle" class="btn btn-sm" @click="openSettle(checkedKeys as string[])">
            <Wallet :size="14" /> 批量确认到账
          </button>
        </template>

        <button v-if="auth.can(PERM.DEAL_EXPORT)" class="btn btn-ghost btn-sm" @click="handleExport">
          <Download :size="14" /> 导出
        </button>
        <button v-if="canCreate" class="btn btn-sm" @click="openCreate">
          <Plus :size="14" /> 录入成交
        </button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="card table-card rise-in" style="animation-delay: 80ms">
      <NDataTable
        remote
        :columns="columns"
        :data="rows"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
        :row-key="(r: DealListItem) => r.id"
        :scroll-x="1400"
        :checked-row-keys="checkedKeys"
        @update:checked-row-keys="(keys) => { checkedKeys = keys; }"
        @update:page="onPage"
        @update:page-size="onPageSize"
        @update:sorter="onSorter"
      />
    </div>

    <!-- 录入成交 Modal -->
    <DealCreateModal v-model:show="showCreate" @created="reload" />

    <!-- 结算弹窗 -->
    <NModal v-model:show="showSettle" preset="card" title="确认到账" style="max-width: 460px">
      <div class="settle-body">
        <p>确认 <strong>{{ settleIds.length }}</strong> 笔成交的佣金已到账，确认后状态变为「已结算」。</p>
        <NForm label-placement="left" label-width="80" :show-feedback="false">
          <NFormItem label="到账日期" required>
            <NDatePicker v-model:value="settleForm.settledAt" type="date" style="width: 100%" />
          </NFormItem>
          <NFormItem label="备注">
            <NInput v-model:value="settleForm.settleNote" placeholder="备注（可选）" maxlength="500" />
          </NFormItem>
        </NForm>
      </div>
      <template #action>
        <div style="display: flex; gap: 8px; justify-content: flex-end">
          <button class="btn btn-ghost" @click="showSettle = false">取消</button>
          <button class="btn" @click="doSettle">
            <Wallet :size="14" /> 确认到账
          </button>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.inline-field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.field-hint {
  font-size: 12px;
  white-space: nowrap;
}
.summary-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.summary-card {
  padding: 16px 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
}
.summary-label { font-size: 12px; margin-bottom: 4px; }
.summary-value {
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.summary-value.warning { color: var(--warning); }
.summary-value.brand { color: var(--brand); }
.summary-unit { font-size: 13px; font-weight: 500; color: var(--text-3); margin-left: 4px; }
.filter-card { padding: 4px 16px; margin-bottom: 12px; }
@media (max-width: 900px) {
  .summary-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.summary-value.info { color: var(--info); }
.summary-value.success { color: var(--success); }
.summary-value.danger { color: var(--danger); }
.summary-sub { font-size: 12px; margin-top: 2px; }

.status-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  margin-bottom: 12px;
}
.status-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 0;
  border-radius: 99px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.status-tab:hover { background: var(--neutral-soft); }
.status-tab.active {
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 500;
}
.tab-count {
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  text-align: center;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  flex-wrap: wrap;
}
.search { flex: 1; min-width: 200px; max-width: 340px; }
.sel { width: 200px; }
.date-pick { width: 260px; }
.toolbar-right { margin-left: auto; display: flex; gap: 8px; align-items: center; }

.table-card { margin-top: 12px; overflow: hidden; }
.table-card :deep(.n-data-table-td) { height: 48px; }
.table-card :deep(.n-data-table__pagination) {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  margin: 0;
}

.link { color: var(--brand); cursor: pointer; }
.link:hover { text-decoration: underline; }
.text-bold { font-weight: 500; }
.text-warning { color: var(--warning) !important; }
.sm { font-size: 13px; }

.audit-info { display: flex; flex-direction: column; gap: 10px; }
.audit-row { display: flex; gap: 12px; font-size: 14px; }
.audit-row .text-3 { width: 60px; flex-shrink: 0; text-align: right; }
.audit-divider { height: 1px; background: var(--border); margin: 4px 0; }

.settle-body p { margin: 0 0 12px; }
.scope-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-3);
}
</style>
