<script setup lang="ts">
import { computed, h, reactive, ref, watch, onMounted } from 'vue';
import { NDataTable, NInput, NSelect, NDatePicker, NTag, NPopover, useMessage, type DataTableColumns } from 'naive-ui';
import { useDebounceFn } from '@vueuse/core';
import { RotateCcw, Search } from 'lucide-vue-next';
import { ROLE_LABEL, type Role } from '@bdcrm/shared';
import { logApi, type AuditLogItem, type AuditLogQuery } from '@/api';
import { ApiError } from '@/api/http';
import { date, dateTime } from '@/utils/format';

const message = useMessage();

const MODULE_LABELS: Record<string, string> = {
  auth: '认证',
  org: '机构',
  deal: '成交',
  lead: '线索',
  user: '账号',
  settle: '结算',
  import: '导入',
  export: '导出',
};

const ACTION_LABELS: Record<string, string> = {
  login: '登录',
  loginFail: '登录失败',
  logout: '注销',
  create: '新增',
  update: '编辑',
  delete: '删除',
  addContact: '添加联系人',
  addProduct: '添加产品',
  addFollowUp: '添加流量顾问成交记录',
  addReview: '添加评价',
  deleteReview: '删除评价',
  updateProduct: '编辑产品',
  deleteAttachment: '删除附件',
  approve: '审核通过',
  reject: '审核驳回',
  batchApprove: '批量通过',
  settle: '结算',
  revokeSettle: '撤销结算',
  assign: '分配跟进人',
  sign: '登记签约',
  export: '导出',
  enable: '启用',
  disable: '停用',
  resetPassword: '重置密码',
  changePassword: '修改密码',
};

/* ---------- 筛选 ---------- */
const filters = reactive({
  keyword: '',
  module: null as string | null,
  dateRange: null as [number, number] | null,
  page: 1,
});
const pageSize = ref(20);
const rows = ref<AuditLogItem[]>([]);
const total = ref(0);
const loading = ref(false);

const moduleOptions = ref<Array<{ label: string; value: string }>>([]);

async function loadModules() {
  try {
    const mods = await logApi.modules();
    moduleOptions.value = mods.map((m) => ({ label: MODULE_LABELS[m] ?? m, value: m }));
  } catch {}
}

let seq = 0;
async function load() {
  const my = ++seq;
  loading.value = true;
  try {
    const res = await logApi.list({
      page: filters.page,
      pageSize: pageSize.value,
      module: filters.module ?? undefined,
      keyword: filters.keyword || undefined,
      startDate: filters.dateRange ? date(filters.dateRange[0]) : undefined,
      endDate: filters.dateRange ? date(filters.dateRange[1]) : undefined,
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

const debouncedKeyword = useDebounceFn(() => { filters.page = 1; load(); }, 300);
watch(() => filters.keyword, debouncedKeyword);
watch(() => [filters.module, filters.dateRange], () => { filters.page = 1; load(); });

function reset() {
  Object.assign(filters, { keyword: '', module: null, dateRange: null, page: 1 });
}

const hasFilter = computed(() => !!(filters.keyword || filters.module || filters.dateRange));

/* ---------- 表格列 ---------- */

function moduleTag(mod: string) {
  const toneMap: Record<string, string> = {
    auth: 'default', org: 'info', deal: 'success', user: 'warning', settle: 'info', export: 'default',
  };
  return h(NTag, { size: 'small', type: (toneMap[mod] ?? 'default') as any, bordered: false }, () => MODULE_LABELS[mod] ?? mod);
}

function jsonPreview(data: unknown) {
  if (data == null || (typeof data === 'object' && !Object.keys(data as object).length)) return '--';
  const text = JSON.stringify(data, null, 2);
  return h(NPopover, { trigger: 'hover', placement: 'left', style: 'max-width: 400px' }, {
    trigger: () => h('span', { class: 'json-preview text-3' }, '查看详情'),
    default: () => h('pre', { style: 'font-size: 12px; margin: 0; white-space: pre-wrap; max-height: 300px; overflow: auto' }, text),
  });
}

const columns = computed<DataTableColumns<AuditLogItem>>(() => [
  {
    title: '时间',
    key: 'createdAt',
    width: 160,
    render: (r) => h('span', { class: 'num text-2' }, dateTime(r.createdAt)),
  },
  { title: '模块', key: 'module', width: 80, render: (r) => moduleTag(r.module) },
  {
    title: '操作',
    key: 'action',
    width: 100,
    render: (r) => ACTION_LABELS[r.action] ?? r.action,
  },
  {
    title: '操作人',
    key: 'userName',
    width: 100,
    render: (r) => h('span', null, [
      r.userName,
      r.role ? h('span', { class: 'text-3', style: 'margin-left: 4px; font-size: 11px' }, `(${ROLE_LABEL[r.role as Role] ?? r.role})`) : null,
    ]),
  },
  {
    title: '操作对象',
    key: 'targetName',
    width: 160,
    ellipsis: { tooltip: true },
    render: (r) => r.targetName ?? '--',
  },
  { title: 'IP', key: 'ip', width: 130, render: (r) => h('span', { class: 'num text-3' }, r.ip ?? '--') },
  {
    title: '变更前',
    key: 'before',
    width: 80,
    render: (r) => jsonPreview(r.before),
  },
  {
    title: '变更后',
    key: 'after',
    width: 80,
    render: (r) => jsonPreview(r.after),
  },
]);

const pagination = computed(() => ({
  page: filters.page,
  pageSize: pageSize.value,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
  prefix: () => `共 ${total.value} 条`,
}));

/* ---------- 初始化 ---------- */
onMounted(() => { loadModules(); load(); });
</script>

<template>
  <div class="page">
    <div class="card toolbar rise-in">
      <NInput v-model:value="filters.keyword" placeholder="搜索操作人、操作对象" clearable class="search">
        <template #prefix><Search :size="16" :stroke-width="1.75" class="text-3" /></template>
      </NInput>
      <NSelect
        v-model:value="filters.module"
        :options="moduleOptions"
        placeholder="模块"
        clearable
        class="sel"
      />
      <NDatePicker v-model:value="filters.dateRange" type="daterange" clearable placeholder="时间范围" class="date-pick" />
      <button v-if="hasFilter" class="link-btn reset" @click="reset"><RotateCcw :size="14" /> 重置</button>
    </div>

    <div class="card table-card rise-in" style="animation-delay: 40ms">
      <NDataTable
        remote
        :columns="columns"
        :data="rows"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
        :row-key="(r: AuditLogItem) => r.id"
        :scroll-x="1000"
        @update:page="(p) => { filters.page = p; load(); }"
        @update:page-size="(s) => { pageSize = s; filters.page = 1; load(); }"
      />
    </div>
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
.search { flex: 1; min-width: 200px; max-width: 340px; }
.sel { width: 140px; }
.date-pick { width: 240px; }
.table-card { margin-top: 12px; overflow: hidden; }
.table-card :deep(.n-data-table-td) { height: 44px; }
.table-card :deep(.n-data-table__pagination) {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  margin: 0;
}
:deep(.json-preview) {
  cursor: pointer;
  text-decoration: underline dotted;
}
</style>
