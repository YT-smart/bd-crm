<script setup lang="ts">
import { computed, h, reactive, ref, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  NDataTable, NInput, NSelect, NDatePicker, NModal,
  NForm, NFormItem, NTag, useMessage, useDialog,
  type DataTableColumns, type DataTableRowKey,
} from 'naive-ui';
import { useDebounceFn } from '@vueuse/core';
import {
  CheckCircle2, Download, Plus, RotateCcw, Search,
  XCircle, Wallet, Undo2, Lock,
} from 'lucide-vue-next';
import {
  DealStatus, DEAL_STATUS_LABEL, PERM,
  type DealListItem, type DealListQuery, type DealSummary,
} from '@bdcrm/shared';
import { dealApi } from '@/api';
import { ApiError } from '@/api/http';
import DealCreateModal from '@/components/DealCreateModal.vue';
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
const canAudit = computed(() => auth.can('deal:audit'));
const canSettle = computed(() => auth.can('deal:settle'));

/* ---------- 统计 ---------- */
const summary = ref<DealSummary | null>(null);
async function loadSummary() {
  try { summary.value = await dealApi.summary(); } catch {}
}

/* ---------- 状态 Tab ---------- */
const statusTabs = computed<Array<{ label: string; value: string | null; count: number }>>(() => {
  const s = summary.value;
  return [
    { label: '全部', value: null, count: s?.total ?? 0 },
    { label: '待审核', value: DealStatus.PENDING_AUDIT, count: s?.pendingAudit ?? 0 },
    { label: '待到账', value: DealStatus.PENDING_PAYMENT, count: s?.pendingPayment ?? 0 },
    { label: '已结算', value: DealStatus.SETTLED, count: s?.settled ?? 0 },
    { label: '已驳回', value: DealStatus.REJECTED, count: s?.rejected ?? 0 },
  ];
});

/** 员工只能看自己录入的成交，管理员看全部，机构账号看本机构 */
const ownOnly = computed(() => auth.user?.role === 'STAFF' && !auth.can(PERM.DEAL_VIEW_ALL));

/* ---------- 筛选与列表 ---------- */
const filters = reactive({
  keyword: '',
  status: null as DealStatus | null,
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
const pageSize = ref(20);
const sort = ref<{ key: DealListQuery['sort']; order: 'asc' | 'desc' } | null>(null);
const rows = ref<DealListItem[]>([]);
const total = ref(0);
const loading = ref(false);
const checkedKeys = ref<DataTableRowKey[]>([]);

let seq = 0;
async function load() {
  const my = ++seq;
  loading.value = true;
  try {
    const res = await dealApi.list({
      page: filters.page,
      pageSize: pageSize.value,
      keyword: filters.keyword || undefined,
      status: filters.status ?? undefined,
      startDate: filters.dateRange ? date(filters.dateRange[0]) : undefined,
      endDate: filters.dateRange ? date(filters.dateRange[1]) : undefined,
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

async function reload() { await Promise.all([load(), loadSummary()]); }

const debouncedKeyword = useDebounceFn(() => { filters.page = 1; load(); }, 300);
watch(() => filters.keyword, debouncedKeyword);
watch(() => [filters.status, filters.dateRange], () => { filters.page = 1; load(); });
// 仪表盘带过来的日期参数只用于首次进入；之后改动日期筛选就去掉，避免刷新又被带回来
watch(() => filters.dateRange, () => {
  if (route.query.start || route.query.end) router.replace({ query: { ...route.query, start: undefined, end: undefined } });
});

function resetFilters() {
  Object.assign(filters, { keyword: '', status: null, dateRange: null, page: 1 });
  checkedKeys.value = [];
}

function onPage(p: number) { filters.page = p; load(); }
function onPageSize(s: number) { pageSize.value = s; filters.page = 1; load(); }
function onSorter(s: any) {
  sort.value = s && s.order ? { key: s.columnKey, order: s.order === 'ascend' ? 'asc' : 'desc' } : null;
  load();
}

/** 排序下拉（与表头排序同步）：机构太多不再提供机构下拉，用关键词搜机构名即可 */
const SORT_OPTIONS = [
  { label: '默认排序', value: '' },
  { label: '成交额从高到低', value: 'amount:desc' },
  { label: '成交额从低到高', value: 'amount:asc' },
  { label: '佣金从高到低', value: 'commission:desc' },
  { label: '佣金从低到高', value: 'commission:asc' },
  { label: '成交日期最新', value: 'dealAt:desc' },
  { label: '成交日期最早', value: 'dealAt:asc' },
  { label: '录入时间最新', value: 'createdAt:desc' },
  { label: '录入时间最早', value: 'createdAt:asc' },
];
const sortValue = computed({
  get: () => (sort.value ? `${sort.value.key}:${sort.value.order}` : ''),
  set: (v: string) => {
    const [key, order] = v.split(':');
    sort.value = v ? { key: key as DealListQuery['sort'], order: order as 'asc' | 'desc' } : null;
    filters.page = 1;
    load();
  },
});

/* ---------- 机构选项 ---------- */


/* ---------- 录入成交 ---------- */
const showCreate = ref(false);
function openCreate() {
  showCreate.value = true;
}

/* ---------- 审核弹窗 ---------- */
const auditTarget = ref<DealListItem | null>(null);
const rejectReason = ref('');
const showAudit = ref(false);

function openAudit(row: DealListItem) {
  auditTarget.value = row;
  rejectReason.value = '';
  showAudit.value = true;
}

async function doAudit(action: 'approve' | 'reject') {
  if (!auditTarget.value) return;
  try {
    await dealApi.audit(auditTarget.value.id, {
      action,
      rejectReason: action === 'reject' ? rejectReason.value : undefined,
    });
    message.success(action === 'approve' ? '已通过' : '已驳回');
    showAudit.value = false;
    reload();
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '操作失败');
  }
}

async function doBatchApprove() {
  if (!checkedKeys.value.length) { message.warning('请先勾选记录'); return; }
  dialog.info({
    title: '批量审核',
    content: `确定将选中的 ${checkedKeys.value.length} 条记录全部审核通过？`,
    positiveText: '全部通过',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const r = await dealApi.batchApprove(checkedKeys.value as string[]);
        message.success(`已通过 ${r.updated} 条`);
        checkedKeys.value = [];
        reload();
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : '操作失败');
      }
    },
  });
}

/* ---------- 结算 ---------- */
const showSettle = ref(false);
const settleForm = reactive({
  settledAt: Date.now() as number | null,
  settleNote: '',
});

function openSettle() {
  if (!checkedKeys.value.length) { message.warning('请先勾选待结算记录'); return; }
  settleForm.settledAt = Date.now();
  settleForm.settleNote = '';
  showSettle.value = true;
}

async function doSettle() {
  if (!settleForm.settledAt) { message.warning('请选择结算日期'); return; }
  try {
    const r = await dealApi.settle({
      dealIds: checkedKeys.value as string[],
      settledAt: new Date(settleForm.settledAt).toISOString(),
      settleNote: settleForm.settleNote.trim() || undefined,
    });
    message.success(`已结算 ${r.updated} 条`);
    showSettle.value = false;
    checkedKeys.value = [];
    reload();
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '结算失败');
  }
}

/* ---------- 撤销结算 ---------- */
function handleRevoke(row: DealListItem) {
  const revokeReason = ref('');
  dialog.warning({
    title: '撤销结算',
    content: () => h('div', [
      h('p', `确定撤销"${row.studentName}"的结算状态？将回退为"待到账"。`),
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
        message.success('已撤销结算');
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
    const data = await dealApi.exportData({
      keyword: filters.keyword || undefined,
      status: filters.status ?? undefined,
      startDate: filters.dateRange ? date(filters.dateRange[0]) : undefined,
      endDate: filters.dateRange ? date(filters.dateRange[1]) : undefined,
    });
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

  // 复选框列
  if (canAudit.value || canSettle.value) {
    cols.push({ type: 'selection', fixed: 'left' });
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
      render: (r) => h('span', { class: 'num text-2' }, date(r.dealAt)),
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
      render: (r) => h('span', { class: 'num text-2' }, date(r.createdAt)),
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
      if (r.status === DealStatus.PENDING_AUDIT && canAudit.value) {
        btns.push(h('button', { class: 'link-btn sm', onClick: (e: Event) => { e.stopPropagation(); openAudit(r); } }, '审核'));
      }
      if (r.status === DealStatus.SETTLED && canSettle.value) {
        btns.push(h('button', { class: 'link-btn sm text-warning', onClick: (e: Event) => { e.stopPropagation(); handleRevoke(r); } }, '撤销'));
      }
      if (r.rejectReason) {
        btns.push(h(NTag, { size: 'small', type: 'error', bordered: false }, () => r.rejectReason));
      }
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

const hasFilter = computed(() => !!(filters.keyword || filters.dateRange));

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

    <!-- 统计卡片 -->
    <div v-if="summary" class="summary-row rise-in">
      <div class="summary-card">
        <div class="summary-label text-3">待审核</div>
        <div class="summary-value warning">{{ summary.pendingAudit }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label text-3">待到账</div>
        <div class="summary-value info">{{ summary.pendingPayment }}</div>
        <div class="summary-sub text-3">{{ money(summary.pendingPaymentAmount) }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label text-3">已结算</div>
        <div class="summary-value success">{{ summary.settled }}</div>
        <div class="summary-sub text-3">{{ money(summary.settledAmount) }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label text-3">已驳回</div>
        <div class="summary-value danger">{{ summary.rejected }}</div>
      </div>
    </div>

    <!-- 状态 Tab -->
    <div class="card status-tabs rise-in" style="animation-delay: 40ms">
      <button
        v-for="tab in statusTabs" :key="String(tab.value)"
        :class="['status-tab', { active: filters.status === tab.value }]"
        @click="filters.status = tab.value as any"
      >
        {{ tab.label }}
        <span class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- 工具栏 -->
    <div class="card toolbar rise-in" style="animation-delay: 60ms">
      <NInput v-model:value="filters.keyword" placeholder="搜索学生姓名、机构名" clearable class="search">
        <template #prefix><Search :size="16" :stroke-width="1.75" class="text-3" /></template>
      </NInput>
      <NSelect id="deal-sort" v-model:value="sortValue" :options="SORT_OPTIONS" class="sel" />
      <NDatePicker v-model:value="filters.dateRange" type="daterange" clearable placeholder="成交日期范围" class="date-pick" />
      <button v-if="hasFilter" class="link-btn reset" @click="resetFilters">
        <RotateCcw :size="14" /> 重置
      </button>

      <div class="toolbar-right">
        <!-- 批量操作 -->
        <template v-if="checkedKeys.length > 0">
          <span class="text-2">已选 {{ checkedKeys.length }} 条</span>
          <button v-if="canAudit && filters.status === DealStatus.PENDING_AUDIT" class="btn btn-sm" @click="doBatchApprove">
            <CheckCircle2 :size="14" /> 批量通过
          </button>
          <button v-if="canSettle && filters.status === DealStatus.PENDING_PAYMENT" class="btn btn-sm" @click="openSettle">
            <Wallet :size="14" /> 批量结算
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

    <!-- 审核弹窗 -->
    <NModal v-model:show="showAudit" preset="card" title="审核成交" style="max-width: 480px">
      <div v-if="auditTarget" class="audit-info">
        <div class="audit-row">
          <span class="text-3">学生</span><span>{{ auditTarget.studentName }}</span>
        </div>
        <div class="audit-row">
          <span class="text-3">机构</span><span>{{ auditTarget.orgName }}</span>
        </div>
        <div class="audit-row">
          <span class="text-3">成交额</span><span class="num">{{ money(auditTarget.amount) }}</span>
        </div>
        <div class="audit-row">
          <span class="text-3">佣金</span><span class="num">{{ money(auditTarget.commission) }}（{{ auditTarget.rate }}%）</span>
        </div>
        <div class="audit-divider" />
        <NInput v-model:value="rejectReason" type="textarea" placeholder="驳回原因（仅驳回时必填）" :autosize="{ minRows: 2, maxRows: 4 }" />
      </div>
      <template #action>
        <div style="display: flex; gap: 8px; justify-content: flex-end">
          <button class="btn btn-ghost" @click="showAudit = false">取消</button>
          <button class="btn btn-danger" @click="doAudit('reject')">
            <XCircle :size="14" /> 驳回
          </button>
          <button class="btn" @click="doAudit('approve')">
            <CheckCircle2 :size="14" /> 通过
          </button>
        </div>
      </template>
    </NModal>

    <!-- 结算弹窗 -->
    <NModal v-model:show="showSettle" preset="card" title="批量结算" style="max-width: 460px">
      <div class="settle-body">
        <p>即将结算 <strong>{{ checkedKeys.length }}</strong> 条成交记录。</p>
        <NForm label-placement="left" label-width="80" :show-feedback="false">
          <NFormItem label="结算日期" required>
            <NDatePicker v-model:value="settleForm.settledAt" type="date" style="width: 100%" />
          </NFormItem>
          <NFormItem label="备注">
            <NInput v-model:value="settleForm.settleNote" placeholder="结算备注（可选）" maxlength="500" />
          </NFormItem>
        </NForm>
      </div>
      <template #action>
        <div style="display: flex; gap: 8px; justify-content: flex-end">
          <button class="btn btn-ghost" @click="showSettle = false">取消</button>
          <button class="btn" @click="doSettle">
            <Wallet :size="14" /> 确认结算
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
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
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
.date-pick { width: 240px; }
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
