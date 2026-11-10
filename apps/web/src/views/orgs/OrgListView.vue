<script setup lang="ts">
import { computed, h, reactive, ref, watch, type WritableComputedRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NDataTable, NInput, NSelect, useMessage, type DataTableColumns, type DataTableSortState, type SelectGroupOption } from 'naive-ui';
import { useDebounceFn } from '@vueuse/core';
import { Download, MapPin, Plus, RotateCcw, Search, X } from 'lucide-vue-next';
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_MAX_LEN,
  CITIES_BY_PROVINCE,
  COUNTRIES,
  COUNTRY_GROUPS,
  ORG_LEVELS,
  ORG_STATUS_LABEL,
  PROVINCES,
  isCity,
  isProvince,
  shortProvinceName,
  PERM,
  type OrgListItem,
  type OrgListQuery,
  type OrgStatus,
} from '@bdcrm/shared';
import { orgApi, type OrgFilterFacets } from '@/api';
import FilterRow, { type FilterOption } from '@/components/FilterRow.vue';
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
  const country = s('country');
  const city = s('city');
  const businessType = s('businessType');
  return {
    keyword: s('keyword') ?? '',
    province: province && isProvince(province) ? province : null,
    status: status && status in ORG_STATUS_LABEL ? (status as OrgStatus) : null,
    level: level && (ORG_LEVELS as readonly string[]).includes(level) ? level : null,
    country: country && (COUNTRIES as readonly string[]).includes(country) ? country : null,
    city: city && isCity(city) ? city : null,
    businessType: businessType && businessType.length <= BUSINESS_TYPE_MAX_LEN ? businessType : null,
    page: Math.max(1, Number(s('page')) || 1),
  };
}

const filters = reactive(fromQuery());
const pageSize = ref(20);
/** 默认按成交率从高到低 */
const sort = ref<{ key: OrgListQuery['sort']; order: 'asc' | 'desc' } | null>({ key: 'dealRate', order: 'desc' });

const rows = ref<OrgListItem[]>([]);
const total = ref(0);
const loading = ref(false);
const showCreate = ref(false);

/** 城市下拉：按省份分组，可搜索 */
const cityOptions: SelectGroupOption[] = PROVINCES.map((p) => ({
  type: 'group',
  key: p,
  label: shortProvinceName(p),
  children: CITIES_BY_PROVINCE[p].map((c) => ({ label: c, value: c })),
}));
/** 业务类型：常用项，也可以直接输入自定义类型搜索 */
const businessTypeOptions = BUSINESS_TYPES.map((t) => ({ label: t, value: t }));
const statusOptions = (Object.keys(ORG_STATUS_LABEL) as OrgStatus[]).map((k) => ({ label: ORG_STATUS_LABEL[k], value: k }));
const levelOptions = ORG_LEVELS.map((l) => ({ label: `${l} 级`, value: l }));
/** 热门留学目的地分组排在最前 */
const countryOptions: SelectGroupOption[] = COUNTRY_GROUPS.map((g) => ({
  type: 'group',
  key: g.label,
  label: g.label,
  children: g.items.map((c) => ({ label: c, value: c })),
}));

/* ---------- 筛选面板：单选的按钮行，和 filters 里的单值互转 ---------- */
type SingleKey = 'city' | 'country' | 'businessType' | 'status' | 'level';
const rowModel = (k: SingleKey): WritableComputedRef<string[]> =>
  computed({
    get: () => (filters[k] ? [filters[k] as string] : []),
    set: (v) => {
      (filters as Record<SingleKey, string | null>)[k] = v[0] ?? null;
    },
  });
const cityRow = rowModel('city');
const countryRow = rowModel('country');
const businessRow = rowModel('businessType');
const statusRow = rowModel('status');
const levelRow = rowModel('level');

/**
 * 城市 / 国家：只列固定的常用项（带机构数），其他的从后面的搜索框里选。
 */
const MAIN_CITIES = ['北京', '上海', '深圳', '广州', '杭州', '成都', '重庆', '武汉'];
const MAIN_COUNTRIES: { label: string; value: string }[] = [
  { label: '美国', value: '美国' },
  { label: '英国', value: '英国' },
  { label: '香港', value: '中国香港' },
  { label: '加拿大', value: '加拿大' },
  { label: '新加坡', value: '新加坡' },
  { label: '澳洲', value: '澳大利亚' },
  { label: '新西兰', value: '新西兰' },
];
const facets = ref<OrgFilterFacets | null>(null);
orgApi.filterFacets().then((f) => (facets.value = f)).catch(() => {});

function facetOptions(
  main: { label: string; value: string }[],
  list: { name: string; count: number }[] | undefined,
  current: string | null,
): FilterOption[] {
  const count = new Map((list ?? []).map((c) => [c.name, c.count]));
  const opts: FilterOption[] = main.map((m) => ({ ...m, count: count.get(m.value) }));
  // 从搜索框或地图选的不在常用里，也显示成选中的按钮
  if (current && !opts.some((o) => o.value === current)) opts.push({ label: current, value: current });
  return opts;
}
const cityFacetOptions = computed(() =>
  facetOptions(MAIN_CITIES.map((c) => ({ label: c, value: c })), facets.value?.cities, filters.city),
);
const countryFacetOptions = computed(() => facetOptions(MAIN_COUNTRIES, facets.value?.countries, filters.country));

const businessRowOptions = computed<FilterOption[]>(() => {
  const opts: FilterOption[] = businessTypeOptions.map((o) => ({ ...o }));
  if (filters.businessType && !opts.some((o) => o.value === filters.businessType)) {
    opts.push({ label: filters.businessType, value: filters.businessType });
  }
  return opts;
});

const activeCount = computed(() => [filters.province, filters.city, filters.businessType, filters.status, filters.level, filters.country].filter(Boolean).length);
const canCreate = computed(() => auth.can('org:create'));
const canExport = computed(() => auth.can('org:export'));
const canSeeMoney = auth.can(PERM.ORG_COOPERATION);

function syncUrl() {
  router.replace({
    query: {
      keyword: filters.keyword || undefined,
      province: filters.province ?? undefined,
      status: filters.status ?? undefined,
      level: filters.level ?? undefined,
      country: filters.country ?? undefined,
      city: filters.city ?? undefined,
      businessType: filters.businessType ?? undefined,
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
      country: filters.country ?? undefined,
      city: filters.city ?? undefined,
      businessType: filters.businessType ?? undefined,
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
  () => [filters.province, filters.city, filters.businessType, filters.status, filters.level, filters.country],
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
      next.level !== filters.level ||
      next.country !== filters.country ||
      next.city !== filters.city ||
      next.businessType !== filters.businessType
    ) {
      Object.assign(filters, next);
    }
  },
);

load();

/** 清空筛选，搜索词保留 */
function resetFilters() {
  Object.assign(filters, { province: null, city: null, businessType: null, status: null, level: null, country: null, page: 1 });
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
  // 取消排序时回到默认：成交率从高到低（与后端默认一致，表头箭头也保持一致）
  sort.value =
    s && s.order
      ? { key: s.columnKey as OrgListQuery['sort'], order: s.order === 'ascend' ? 'asc' : 'desc' }
      : { key: 'dealRate', order: 'desc' };
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
      country: filters.country ?? undefined,
      city: filters.city ?? undefined,
      businessType: filters.businessType ?? undefined,
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
    width: 230,
    sorter: true,
    sortOrder: sort.value?.key === 'name' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
    render: (r) =>
      h('div', { class: 'org-cell', style: 'cursor: pointer', title: r.name, onClick: () => goDetail(r) }, [
        h('div', { class: 'org-name ellipsis' }, r.name),
        h(
          'div',
          { class: 'org-meta ellipsis' },
          r.tags.slice(0, 2).join(' · ') || '--',
        ),
      ]),
  },
  {
    title: '业务类型',
    key: 'businessTypes',
    width: 150,
    render: (r) => {
      const list = r.businessTypes ?? [];
      if (!list.length) return h('span', { class: 'text-3' }, '--');
      const MAX = 3;
      return h('div', { class: 'country-cell', title: list.join('、') }, [
        ...list.slice(0, MAX).map((b) => h('span', { class: ['biz-chip', { hit: b === filters.businessType }] }, b)),
        list.length > MAX ? h('span', { class: 'country-more' }, `+${list.length - MAX}`) : null,
      ]);
    },
  },
  {
    title: '城市',
    key: 'region',
    width: 132,
    render: (r) => {
      // 总部城市在前，其余校区城市依次列出；点城市直接筛选该城市的机构
      let cities = [...new Set([r.city, ...(r.officeCities ?? [])].filter((c): c is string => !!c))];
      // 正在筛选的城市排到最前，避免被折叠进 +n
      if (filters.city && cities.includes(filters.city)) cities = [filters.city, ...cities.filter((c) => c !== filters.city)];
      if (!cities.length) return h('span', { class: 'text-3' }, r.province ? shortProvinceName(r.province) : '--');
      const MAX = 3;
      return h('div', { class: 'city-cell', title: cities.join('、') }, [
        ...cities.slice(0, MAX).map((c) =>
          h(
            'button',
            {
              class: ['city-chip', { hit: c === filters.city }],
              title: `查看「${c}」的机构`,
              onClick: (e: MouseEvent) => {
                e.stopPropagation();
                filters.city = filters.city === c ? null : c;
              },
            },
            c,
          ),
        ),
        cities.length > MAX ? h('span', { class: 'country-more' }, `+${cities.length - MAX}`) : null,
      ]);
    },
  },
  {
    title: '主营国家',
    key: 'countries',
    minWidth: 220,
    render: (r) => {
      const list = r.countries ?? [];
      if (!list.length) return h('span', { class: 'text-3' }, '--');
      // 筛选了国家时把它排到最前，方便确认
      const ordered = filters.country && list.includes(filters.country) ? [filters.country, ...list.filter((c) => c !== filters.country)] : list;
      // 放不下时换到第二行：最多显示 5 个，其余用 +n 表示，悬停可看全部
      const MAX = 5;
      const shown = ordered.slice(0, MAX);
      return h('div', { class: 'country-cell', title: list.join('、') }, [
        ...shown.map((c) => h('span', { class: ['country-chip', { hit: c === filters.country }] }, c)),
        list.length > MAX ? h('span', { class: 'country-more' }, `+${list.length - MAX}`) : null,
      ]);
    },
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
  // 佣金比例只给管理员看
  ...(canSeeMoney
    ? [
        {
          title: '默认佣金',
          key: 'defaultRate',
          minWidth: 110,
          align: 'center' as const,
          sorter: true,
          sortOrder: sort.value?.key === 'defaultRate' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
          render: (r: OrgListItem) => h('span', { class: 'num' }, `${r.defaultRate.toFixed(1)}%`),
        } as DataTableColumns<OrgListItem>[number],
      ]
    : []),
  {
    title: '成交率',
    key: 'dealRate',
    minWidth: 110,
    align: 'center',
    sorter: true,
    sortOrder: sort.value?.key === 'dealRate' ? (sort.value.order === 'asc' ? 'ascend' : 'descend') : false,
    render: (r) =>
      r.dealRate === null
        ? h('span', { class: 'text-3', title: '暂无报单' }, '--')
        : h('div', { class: 'rate-cell', title: `已核实成交 ${r.dealCount} 笔 / 报单 ${r.reportCount} 笔` }, [
            h('span', { class: ['num', 'rate-val', r.dealRate >= 60 ? 'good' : r.dealRate < 30 ? 'low' : ''] }, `${r.dealRate.toFixed(1)}%`),
            h('span', { class: 'rate-sub num' }, `${r.dealCount}/${r.reportCount}`),
          ]),
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
    <!-- 筛选面板 -->
    <div class="card filter-card rise-in">
      <FilterRow v-model="businessRow" label="业务类型" :options="businessRowOptions" single>
        <NSelect
          id="org-filter-business"
          :value="null"
          :options="[]"
          placeholder="搜索/输入类型"
          filterable
          tag
          size="small"
          class="more-sel"
          @update:value="(v: string | null) => v && (filters.businessType = v.trim().slice(0, BUSINESS_TYPE_MAX_LEN) || null)"
        />
      </FilterRow>
      <FilterRow v-model="cityRow" label="城市" :options="cityFacetOptions" single>
        <NSelect
          id="org-filter-city"
          :value="null"
          :options="cityOptions"
          placeholder="搜索城市"
          filterable
          size="small"
          class="more-sel"
          @update:value="(v: string | null) => v && (filters.city = v)"
        />
      </FilterRow>
      <FilterRow v-model="countryRow" label="覆盖国家" :options="countryFacetOptions" single>
        <NSelect
          id="org-filter-country"
          :value="null"
          :options="countryOptions"
          placeholder="搜索国家/地区"
          filterable
          size="small"
          class="more-sel"
          @update:value="(v: string | null) => v && (filters.country = v)"
        />
      </FilterRow>
      <FilterRow v-model="statusRow" label="合作状态" :options="statusOptions" single />
      <FilterRow v-model="levelRow" label="机构等级" :options="levelOptions" single />
      <div v-if="activeCount" class="filter-foot">
        <button id="org-filter-reset" class="link-btn" @click="resetFilters">
          <RotateCcw :size="13" /> 清空筛选（{{ activeCount }}）
        </button>
      </div>
    </div>

    <div class="card toolbar rise-in" style="animation-delay: 40ms">
      <NInput id="org-search" v-model:value="filters.keyword" placeholder="搜索机构名称、城市（含校区城市）、联系人、电话" clearable class="search">
        <template #prefix><Search :size="16" :stroke-width="1.75" class="text-3" /></template>
      </NInput>
      <div class="toolbar-right">
        <button v-if="canExport" class="btn btn-ghost btn-sm" @click="handleExport">
          <Download :size="14" /> 导出
        </button>
        <button v-if="canCreate" class="btn btn-sm" @click="showCreate = true">
          <Plus :size="14" /> 新增机构
        </button>
      </div>
    </div>

    <div v-if="filters.city" class="from-map rise-in">
      <MapPin :size="14" :stroke-width="1.75" />
      正在查看在 <strong>{{ filters.city }}</strong> 有校区的机构
      <button id="clear-city" class="chip-x" aria-label="清除城市筛选" @click="filters.city = null"><X :size="12" /></button>
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
.filter-card {
  padding: 4px 16px;
}
.more-sel {
  width: 150px;
}
.filter-foot {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}
.filter-foot .link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
}
.toolbar {
  margin-top: 12px;
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
  max-width: 198px;
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
:deep(.city-cell) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
:deep(.city-chip) {
  font-size: 12px;
  line-height: 20px;
  padding: 0 7px;
  border: 0;
  border-radius: 5px;
  background: var(--info-soft);
  color: var(--info);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
:deep(.city-chip:hover) {
  background: var(--brand-soft);
  color: var(--brand);
}
:deep(.city-chip.hit) {
  background: var(--brand);
  color: #fff;
}
:deep(.biz-chip) {
  font-size: 12px;
  line-height: 20px;
  padding: 0 7px;
  border-radius: 5px;
  background: var(--brand-soft-2);
  color: var(--brand);
  white-space: nowrap;
}
:deep(.biz-chip.hit) {
  background: var(--brand);
  color: #fff;
}
:deep(.country-cell) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
:deep(.country-chip) {
  font-size: 12px;
  line-height: 20px;
  padding: 0 7px;
  border-radius: 5px;
  background: var(--neutral-soft);
  color: var(--text-2);
  white-space: nowrap;
}
:deep(.country-chip.hit) {
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 500;
}
:deep(.country-more) {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text-3);
}
:deep(.rate-cell) {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.3;
}
:deep(.rate-val) {
  font-weight: 600;
  color: var(--text);
}
:deep(.rate-val.good) {
  color: var(--success);
}
:deep(.rate-val.low) {
  color: var(--warning);
}
:deep(.rate-sub) {
  font-size: 11px;
  color: var(--text-3);
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
