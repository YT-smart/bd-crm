<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from 'vue';
import {
  NDataTable, NDatePicker, NInput, NModal, NSelect, useDialog, useMessage,
  type DataTableColumns, type DataTableRowKey,
} from 'naive-ui';
import { useDebounceFn } from '@vueuse/core';
import { ChevronDown, ChevronUp, Download, Lock, Plus, RotateCcw, Search, UserPlus } from 'lucide-vue-next';
import {
  LEAD_DEGREES, LEAD_GRADES, LEAD_INTENTIONS, LEAD_PRODUCT_TAGS, LEAD_PUSH_STATUS,
  LEAD_REGIONS, LEAD_SOURCES, LEAD_WECHAT_STATUS, PERM,
  type LeadListItem, type LeadListQuery, type LeadStatusCounts, type StaffOption,
} from '@bdcrm/shared';
import { leadApi, orgApi, type LeadFilterOptions } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { date } from '@/utils/format';
import FilterRow, { type FilterOption } from '@/components/FilterRow.vue';
import LeadFormModal from './LeadFormModal.vue';
import LeadDrawer from './LeadDrawer.vue';
import { intentionPill, pushPill } from './leadStyle';

const message = useMessage();
const dialog = useDialog();
const auth = useAuthStore();

/** 管理员：看全部、分配跟进人、删除；员工只看自己录入或分给自己的 */
const canManage = computed(() => auth.can(PERM.LEAD_MANAGE));
const canEdit = computed(() => auth.can(PERM.LEAD_EDIT));
const canSign = computed(() => auth.can(PERM.DEAL_CREATE) && auth.user?.role !== 'ORG');

/* ---------- 筛选 ---------- */
type Range = [number, number] | null;
const blankFilters = () => ({
  keyword: '',
  createdRange: null as Range,
  updatedRange: null as Range,
  assignedRange: null as Range,
  source: null as string | null,
  orgId: null as string | null,
  pushStatus: [] as string[],
  productTags: [] as string[],
  assigneeIds: [] as string[],
  grades: [] as string[],
  creatorIds: [] as string[],
  degrees: [] as string[],
  wechatStatus: [] as string[],
  regions: [] as string[],
  intentions: [] as string[],
});
const filters = reactive(blankFilters());
const page = ref(1);
const pageSize = ref(20);
const sortValue = ref('createdAt:desc');

const SORT_OPTIONS = [
  { label: '创建时间最新', value: 'createdAt:desc' },
  { label: '创建时间最早', value: 'createdAt:asc' },
  { label: '最近更新', value: 'updatedAt:desc' },
  { label: '分配时间最新', value: 'assignedAt:desc' },
];

const opts = (arr: readonly string[]): FilterOption[] => arr.map((v) => ({ label: v, value: v }));
const people = (arr: StaffOption[] | undefined): FilterOption[] => (arr ?? []).map((u) => ({ label: u.name, value: u.id }));

const filterOptions = ref<LeadFilterOptions | null>(null);
const counts = ref<LeadStatusCounts | null>(null);
const statusOptions = computed<FilterOption[]>(() =>
  LEAD_PUSH_STATUS.map((s) => ({ label: s, value: s, count: counts.value?.[s] ?? undefined })),
);

/** 筛选面板收起时只显示前几行 */
const collapsed = ref(readCollapsed());
function readCollapsed() {
  try { return localStorage.getItem('lead-filter-collapsed') === '1'; } catch { return false; }
}
watch(collapsed, (v) => { try { localStorage.setItem('lead-filter-collapsed', v ? '1' : '0'); } catch {} });

const day = (r: Range, i: 0 | 1) => (r ? date(r[i]) : undefined);
const csv = (a: string[]) => (a.length ? a.join(',') : undefined);

function buildQuery(): LeadListQuery {
  const [sort, order] = sortValue.value.split(':') as [LeadListQuery['sort'], 'asc' | 'desc'];
  return {
    keyword: filters.keyword.trim() || undefined,
    createdFrom: day(filters.createdRange, 0), createdTo: day(filters.createdRange, 1),
    updatedFrom: day(filters.updatedRange, 0), updatedTo: day(filters.updatedRange, 1),
    assignedFrom: day(filters.assignedRange, 0), assignedTo: day(filters.assignedRange, 1),
    source: filters.source ?? undefined,
    orgId: filters.orgId ?? undefined,
    pushStatus: csv(filters.pushStatus),
    productTags: csv(filters.productTags),
    assigneeIds: csv(filters.assigneeIds),
    grades: csv(filters.grades),
    creatorIds: csv(filters.creatorIds),
    degrees: csv(filters.degrees),
    wechatStatus: csv(filters.wechatStatus),
    regions: csv(filters.regions),
    intentions: csv(filters.intentions),
    sort,
    order,
  };
}

const activeCount = computed(() => {
  const f = filters;
  return [
    f.createdRange, f.updatedRange, f.assignedRange, f.source, f.orgId,
  ].filter(Boolean).length + [
    f.pushStatus, f.productTags, f.assigneeIds, f.grades, f.creatorIds, f.degrees, f.wechatStatus, f.regions, f.intentions,
  ].filter((a) => a.length).length;
});

/* ---------- 列表 ---------- */
const rows = ref<LeadListItem[]>([]);
const total = ref(0);
const loading = ref(false);
const checkedKeys = ref<DataTableRowKey[]>([]);

let seq = 0;
async function load() {
  const my = ++seq;
  loading.value = true;
  const q = buildQuery();
  try {
    const [res, c] = await Promise.all([
      leadApi.list({ ...q, page: page.value, pageSize: pageSize.value }),
      leadApi.counts(q),
    ]);
    if (my !== seq) return;
    rows.value = res.list;
    total.value = res.total;
    counts.value = c;
  } catch (e) {
    if (my === seq) message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    if (my === seq) loading.value = false;
  }
}
async function loadFilterOptions() {
  try { filterOptions.value = await leadApi.filterOptions(); } catch {}
}
function reloadAll() {
  load();
  loadFilterOptions();
}

const reloadFirstPage = () => { page.value = 1; checkedKeys.value = []; load(); };
watch(() => filters.keyword, useDebounceFn(reloadFirstPage, 300));
watch(
  () => { const { keyword: _k, ...rest } = filters; return JSON.stringify(rest); },
  reloadFirstPage,
);
watch(sortValue, reloadFirstPage);

function resetFilters() {
  Object.assign(filters, blankFilters());
}

/* ---------- 机构筛选：选项来自已有线索的跟进机构 ---------- */
const orgFilterOptions = computed(() => (filterOptions.value?.orgs ?? []).map((o) => ({ label: o.name, value: o.id })));
const sourceOptions = LEAD_SOURCES.map((s) => ({ label: s, value: s }));

/* ---------- 新增 / 编辑 ---------- */
const showForm = ref(false);
const editing = ref<LeadListItem | null>(null);
const staff = ref<StaffOption[]>([]);
async function ensureStaff() {
  if (canManage.value && !staff.value.length) {
    try { staff.value = await orgApi.staffOptions(); } catch {}
  }
}
async function openCreate() {
  await ensureStaff();
  editing.value = null;
  showForm.value = true;
}
async function openEdit(l: LeadListItem) {
  await ensureStaff();
  editing.value = l;
  showForm.value = true;
}
function onSaved() {
  reloadAll();
  drawerRef.value?.reload();
}

/* ---------- 详情抽屉 ---------- */
const showDrawer = ref(false);
const drawerId = ref<string | null>(null);
const drawerRef = ref<InstanceType<typeof LeadDrawer> | null>(null);
function openDrawer(l: LeadListItem) {
  drawerId.value = l.id;
  showDrawer.value = true;
}

/* ---------- 分配跟进人（管理员） ---------- */
const showAssign = ref(false);
const assignTo = ref<string | null>(null);
async function openAssign() {
  if (!checkedKeys.value.length) { message.warning('请先勾选线索'); return; }
  await ensureStaff();
  assignTo.value = null;
  showAssign.value = true;
}
async function doAssign() {
  try {
    const r = await leadApi.assign(checkedKeys.value as string[], assignTo.value);
    message.success(assignTo.value ? `已分配 ${r.updated} 条` : `已取消分配 ${r.updated} 条`);
    showAssign.value = false;
    checkedKeys.value = [];
    reloadAll();
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '分配失败');
  }
}

/* ---------- 删除（管理员） ---------- */
function handleDelete(l: LeadListItem) {
  dialog.warning({
    title: '删除线索',
    content: `确定删除「${l.studentName}」吗？跟进记录会一起删除，已生成的成交记录会保留。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await leadApi.remove(l.id);
        message.success('已删除');
        reloadAll();
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : '删除失败');
      }
    },
  });
}

/* ---------- 导出 ---------- */
async function handleExport() {
  try {
    const data = await leadApi.exportData(buildQuery());
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '客户线索');
    XLSX.writeFile(wb, `客户线索_${date(new Date())}.xlsx`);
    message.success(`已导出 ${data.length} 条`);
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '导出失败');
  }
}

/* ---------- 表格 ---------- */
const tags = (arr: string[]) =>
  arr.length ? h('div', { class: 'tags' }, arr.map((t) => h('span', { class: 'mini-tag' }, t))) : h('span', { class: 'text-3' }, '--');
const text = (v: string | null) => v ?? h('span', { class: 'text-3' }, '--');

const columns = computed<DataTableColumns<LeadListItem>>(() => {
  const cols: DataTableColumns<LeadListItem> = [];
  if (canManage.value) cols.push({ type: 'selection', fixed: 'left' });
  cols.push(
    {
      title: '学生', key: 'studentName', width: 150, fixed: 'left',
      render: (r) => h('div', { class: 'stu' }, [
        h('span', { class: 'stu-name' }, r.studentName),
        h('span', { class: 'stu-sub num text-3' }, r.phone ?? r.wechat ?? '--'),
      ]),
    },
    { title: '推出状态', key: 'pushStatus', width: 96, render: (r) => h('span', { class: ['pill', pushPill(r.pushStatus)] }, r.pushStatus) },
    {
      title: '意向度', key: 'intention', width: 92,
      render: (r) => (r.intention ? h('span', { class: ['pill', 'plain', intentionPill(r.intention)] }, r.intention) : text(null)),
    },
    { title: '产品标签', key: 'productTags', width: 170, render: (r) => tags(r.productTags) },
    { title: '年级', key: 'grade', width: 104, render: (r) => text(r.grade) },
    { title: '申请学历', key: 'degree', width: 92, render: (r) => text(r.degree) },
    { title: '留学地区', key: 'regions', width: 140, render: (r) => tags(r.regions) },
    { title: '来源', key: 'source', width: 112, render: (r) => text(r.source) },
    { title: '添加微信', key: 'wechatStatus', width: 92, render: (r) => text(r.wechatStatus) },
    { title: '跟进机构', key: 'orgName', width: 160, ellipsis: { tooltip: true }, render: (r) => text(r.orgName) },
    { title: '跟进人', key: 'assigneeName', width: 84, render: (r) => r.assigneeName ?? h('span', { class: 'text-warning' }, '未分配') },
    { title: '创建人', key: 'createdByName', width: 84 },
    {
      title: '最近跟进', key: 'lastFollowAt', width: 108,
      render: (r) => h('span', { class: 'num text-2' }, r.lastFollowAt ? `${date(r.lastFollowAt)}（${r.followCount}）` : '--'),
    },
    { title: '创建时间', key: 'createdAt', width: 100, render: (r) => h('span', { class: 'num text-2' }, date(r.createdAt)) },
    {
      title: '操作', key: 'actions', width: canManage.value ? 150 : 110, fixed: 'right',
      render: (r) => {
        const stop = (fn: () => void) => (e: Event) => { e.stopPropagation(); fn(); };
        const btns = [h('button', { class: 'link-btn sm', onClick: stop(() => openDrawer(r)) }, '跟进')];
        if (canEdit.value) btns.push(h('button', { class: 'link-btn sm', onClick: stop(() => openEdit(r)) }, '编辑'));
        if (canManage.value) btns.push(h('button', { class: 'link-btn sm text-danger', onClick: stop(() => handleDelete(r)) }, '删除'));
        return h('div', { style: 'display:flex;gap:12px;white-space:nowrap' }, btns);
      },
    },
  );
  return cols;
});

const pagination = computed(() => ({
  page: page.value,
  pageSize: pageSize.value,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
  prefix: () => `共 ${total.value} 条`,
}));
const rowProps = (r: LeadListItem) => ({ style: 'cursor: pointer', onClick: () => openDrawer(r) });

onMounted(() => {
  load();
  loadFilterOptions();
});
</script>

<template>
  <div class="page">
    <div v-if="!canManage" class="scope-note rise-in">
      <Lock :size="13" :stroke-width="1.75" /> 仅自己可见
    </div>

    <!-- 筛选面板 -->
    <div class="card filter-card rise-in">
      <div class="frow time-row">
        <div class="frow-label">时间：</div>
        <div class="frow-opts">
          <NDatePicker v-model:value="filters.createdRange" type="daterange" clearable start-placeholder="创建时间开始" end-placeholder="创建时间结束" class="range" />
          <NDatePicker v-model:value="filters.updatedRange" type="daterange" clearable start-placeholder="更新时间开始" end-placeholder="更新时间结束" class="range" />
          <NDatePicker v-model:value="filters.assignedRange" type="daterange" clearable start-placeholder="分配时间开始" end-placeholder="分配时间结束" class="range" />
        </div>
      </div>
      <div class="frow">
        <div class="frow-label">来源：</div>
        <div class="frow-opts">
          <NSelect v-model:value="filters.source" :options="sourceOptions" clearable placeholder="来源" class="sel" />
          <NSelect v-model:value="filters.orgId" :options="orgFilterOptions" clearable filterable placeholder="跟进机构" class="sel" />
        </div>
      </div>
      <FilterRow v-model="filters.pushStatus" label="推出状态" :options="statusOptions" />
      <FilterRow v-model="filters.productTags" label="产品标签" :options="opts(LEAD_PRODUCT_TAGS)" />
      <template v-if="!collapsed">
        <FilterRow v-model="filters.assigneeIds" label="跟进人" :options="people(filterOptions?.assignees)" />
        <FilterRow v-model="filters.grades" label="就读年级" :options="opts(LEAD_GRADES)" />
        <FilterRow v-model="filters.creatorIds" label="创建人" :options="people(filterOptions?.creators)" />
        <FilterRow v-model="filters.degrees" label="申请学历" :options="opts(LEAD_DEGREES)" />
        <FilterRow v-model="filters.wechatStatus" label="添加微信" :options="opts(LEAD_WECHAT_STATUS)" />
        <FilterRow v-model="filters.regions" label="留学地区" :options="opts(LEAD_REGIONS)" />
        <FilterRow v-model="filters.intentions" label="意向度" :options="opts(LEAD_INTENTIONS)" />
      </template>
      <div class="filter-foot">
        <button class="link-btn" @click="collapsed = !collapsed">
          <template v-if="collapsed"><ChevronDown :size="14" /> 展开更多筛选</template>
          <template v-else><ChevronUp :size="14" /> 收起</template>
        </button>
        <button v-if="activeCount" class="link-btn" @click="resetFilters">
          <RotateCcw :size="13" /> 清空筛选（{{ activeCount }}）
        </button>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="card toolbar rise-in" style="animation-delay: 40ms">
      <NInput v-model:value="filters.keyword" placeholder="搜索学生姓名、手机号、微信、备注、机构" clearable class="search">
        <template #prefix><Search :size="16" :stroke-width="1.75" class="text-3" /></template>
      </NInput>
      <NSelect v-model:value="sortValue" :options="SORT_OPTIONS" class="sort" />
      <div class="toolbar-right">
        <template v-if="canManage && checkedKeys.length">
          <span class="text-2">已选 {{ checkedKeys.length }} 条</span>
          <button id="lead-assign" class="btn btn-ghost btn-sm" @click="openAssign"><UserPlus :size="14" /> 分配跟进人</button>
        </template>
        <button class="btn btn-ghost btn-sm" @click="handleExport"><Download :size="14" /> 导出</button>
        <button v-if="canEdit" id="lead-create" class="btn btn-sm" @click="openCreate"><Plus :size="14" /> 新增线索</button>
      </div>
    </div>

    <div class="card table-card rise-in" style="animation-delay: 60ms">
      <NDataTable
        remote
        :columns="columns"
        :data="rows"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
        :row-key="(r: LeadListItem) => r.id"
        :row-props="rowProps"
        :scroll-x="1800"
        :checked-row-keys="checkedKeys"
        @update:checked-row-keys="(k) => { checkedKeys = k; }"
        @update:page="(p: number) => { page = p; load(); }"
        @update:page-size="(s: number) => { pageSize = s; page = 1; load(); }"
      />
    </div>

    <LeadFormModal v-model:show="showForm" :lead="editing" :can-assign="canManage" :staff="staff" @saved="onSaved" />
    <LeadDrawer
      ref="drawerRef"
      v-model:show="showDrawer"
      :lead-id="drawerId"
      :can-sign="canSign"
      @edit="openEdit"
      @changed="reloadAll"
    />

    <NModal v-model:show="showAssign" preset="card" title="分配跟进人" style="max-width: 420px">
      <p class="assign-tip">给选中的 <strong>{{ checkedKeys.length }}</strong> 条线索分配跟进人：</p>
      <NSelect
        v-model:value="assignTo"
        :options="staff.map((s) => ({ label: s.name, value: s.id }))"
        clearable filterable placeholder="不选则取消分配"
      />
      <template #action>
        <div style="display: flex; gap: 8px; justify-content: flex-end">
          <button class="btn btn-ghost" @click="showAssign = false">取消</button>
          <button id="assign-submit" class="btn" @click="doAssign">确定</button>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.scope-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-3);
}
.filter-card {
  padding: 4px 16px;
}
/* 时间、来源两行和 FilterRow 同样的版式 */
.frow {
  display: flex;
  gap: 8px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}
.frow-label {
  flex: 0 0 76px;
  padding-top: 6px;
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
}
.frow-opts {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.range {
  width: 300px;
  max-width: 100%;
}
.sel {
  width: 200px;
}
.filter-foot {
  display: flex;
  justify-content: center;
  gap: 18px;
  padding: 8px 0;
}
.filter-foot .link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.search {
  flex: 1;
  min-width: 200px;
  max-width: 360px;
}
.sort {
  width: 150px;
}
.toolbar-right {
  margin-left: auto;
  display: flex;
  gap: 8px;
  align-items: center;
}
.table-card {
  margin-top: 12px;
  overflow: hidden;
}
.table-card :deep(.n-data-table-td) {
  height: 52px;
}
.table-card :deep(.n-data-table-th) {
  white-space: nowrap;
}
.table-card :deep(.n-data-table__pagination) {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  margin: 0;
}
.table-card :deep(.stu) {
  display: flex;
  flex-direction: column;
  line-height: 1.35;
}
.table-card :deep(.stu-name) {
  font-weight: 600;
}
.table-card :deep(.stu-sub) {
  font-size: 12px;
}
.table-card :deep(.tags) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.table-card :deep(.mini-tag) {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--neutral-soft);
  color: var(--text-2);
  font-size: 12px;
  white-space: nowrap;
}
.table-card :deep(.text-warning) {
  color: var(--warning);
}
.table-card :deep(.text-danger) {
  color: var(--danger) !important;
}
.sm {
  font-size: 13px;
}
.assign-tip {
  margin: 0 0 12px;
}
@media (max-width: 640px) {
  .frow {
    flex-direction: column;
    gap: 6px;
  }
  .frow-label {
    flex: none;
    padding-top: 0;
  }
  .range,
  .sel {
    width: 100%;
  }
}
</style>
