<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NInput, NSelect, NSkeleton } from 'naive-ui';
import { useDebounceFn } from '@vueuse/core';
import type { ECharts } from 'echarts/core';
import { ArrowRight, MapPin, Minus, Plus, RotateCcw, Search } from 'lucide-vue-next';
import { BUSINESS_TYPES, shortProvinceName, type MapSearchResult, type ProvinceStat } from '@bdcrm/shared';
import { dashboardApi } from '@/api';
import { CITY_COORDS } from '@/utils/cityCoords';
import EChart from '@/components/EChart.vue';
import { ensureChinaMap, type EChartsOption } from '@/plugins/echarts';
import { tooltipBase, useChartTheme, type ChartTheme } from '@/composables/useChartTheme';
import { money, moneyShort, num } from '@/utils/format';

const props = withDefaults(
  defineProps<{
    provinces: ProvinceStat[];
    loading?: boolean;
    /** 是否展示成交额、佣金等经营数据（仅管理员） */
    finance?: boolean;
  }>(),
  { finance: true },
);

const router = useRouter();
const theme = useChartTheme();

const mapReady = ref(false);
const mapError = ref('');

async function loadMap() {
  mapError.value = '';
  try {
    await ensureChinaMap();
    mapReady.value = true;
  } catch (e) {
    mapError.value = e instanceof Error ? e.message : '地图数据加载失败';
  }
}
onMounted(() => {
  loadMap();
  loadAllCities();
});

/* ---------- 全部机构的校区城市：平时也标在地图上，放大后能看清机构周边 ---------- */
const allCities = shallowRef<MapSearchResult['cities']>([]);
async function loadAllCities() {
  try {
    allCities.value = (await dashboardApi.map({})).cities;
  } catch {
    /* 标点加载失败不影响省份分布 */
  }
}

/* ---------- 缩放：滚轮 / 拖动 / 按钮；放大后显示省名、周边城市 ---------- */
const MIN_ZOOM = 1;
const MAX_ZOOM = 14;
/** 当前缩放和中心点不放进响应式里，拖动时不重算 option；只有跨档时才重算 */
const view: { zoom: number; center?: number[] } = { zoom: 1 };
/** 0：全国；1：显示省名和城市名；2：再显示周边所有城市 */
const zoomTier = ref(0);
const tierOf = (z: number) => (z >= 3.2 ? 2 : z >= 1.8 ? 1 : 0);
const resetKey = ref(0);
let chart: ECharts | null = null;

function onChartReady(c: ECharts) {
  chart = c;
  c.on('georoam', () => {
    const g = (c.getOption().geo as { zoom: number; center?: number[] }[])[0];
    view.zoom = g.zoom;
    view.center = g.center;
    const t = tierOf(g.zoom);
    if (t !== zoomTier.value) zoomTier.value = t;
  });
}
function zoomBy(f: number) {
  if (!chart) return;
  view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * f));
  chart.setOption({ geo: { zoom: view.zoom } });
  zoomTier.value = tierOf(view.zoom);
}
function resetZoom() {
  view.zoom = 1;
  view.center = undefined;
  zoomTier.value = 0;
  resetKey.value++;
}

/* ---------- 地图筛选：机构名称 / 业务类型 → 校区城市标点 ---------- */
const keyword = ref('');
const businessType = ref<string | null>(null);
const businessTypeOptions = BUSINESS_TYPES.map((t) => ({ label: t, value: t }));
const searching = ref(false);
const result = shallowRef<MapSearchResult | null>(null);
const filtering = computed(() => !!(keyword.value.trim() || businessType.value));

let seq = 0;
async function runSearch() {
  if (!filtering.value) {
    result.value = null;
    return;
  }
  const my = ++seq;
  searching.value = true;
  try {
    const r = await dashboardApi.map({ keyword: keyword.value.trim() || undefined, businessType: businessType.value ?? undefined });
    if (my === seq) result.value = r;
  } catch {
    if (my === seq) result.value = null;
  } finally {
    if (my === seq) searching.value = false;
  }
}
const debouncedSearch = useDebounceFn(runSearch, 300);
watch(keyword, debouncedSearch);
watch(businessType, runSearch);

function clearFilter() {
  keyword.value = '';
  businessType.value = null;
}

const filterProvinceMap = computed(() => new Map((result.value?.provinces ?? []).map((p) => [p.name, p])));
const filterMax = computed(() => Math.max(1, ...(result.value?.provinces ?? []).map((p) => p.count)));
const cityPoints = computed(() =>
  (result.value?.cities ?? [])
    .filter((c) => CITY_COORDS[c.name])
    .map((c) => ({ name: c.name, value: [...CITY_COORDS[c.name], c.count], orgs: c.orgs, count: c.count })),
);
const maxCityCount = computed(() => Math.max(1, ...cityPoints.value.map((c) => c.count)));
/** 平时的机构城市标点 */
const orgCityPoints = computed(() =>
  allCities.value
    .filter((c) => CITY_COORDS[c.name])
    .map((c) => ({ name: c.name, value: [...CITY_COORDS[c.name], c.count], orgs: c.orgs, count: c.count })),
);
const maxOrgCityCount = computed(() => Math.max(1, ...orgCityPoints.value.map((c) => c.count)));
/** 放大后显示的周边城市（没有机构的），帮助判断机构附近是哪里 */
const refCityPoints = computed(() => {
  const has = new Set((filtering.value ? cityPoints.value : orgCityPoints.value).map((c) => c.name));
  return Object.entries(CITY_COORDS)
    .filter(([n]) => !has.has(n))
    .map(([name, xy]) => ({ name, value: xy }));
});

const totalOrgs = computed(() => props.provinces.reduce((s, p) => s + p.count, 0));
const coveredProvinces = computed(() => props.provinces.filter((p) => p.count > 0).length);
const ranking = computed(() => [...props.provinces].sort((a, b) => b.count - a.count).slice(0, 8));
const maxCount = computed(() => Math.max(1, ...props.provinces.map((p) => p.count)));
const statByName = computed(() => new Map(props.provinces.map((p) => [p.name, p])));
const topAmount = computed(() =>
  props.provinces.length ? props.provinces.reduce((a, b) => (b.amount > a.amount ? b : a)) : null,
);

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function row(t: ChartTheme, k: string, v: string) {
  return `<div style="display:flex;justify-content:space-between;gap:24px;line-height:1.9"><span style="color:${t.text3}">${k}</span><span style="font-variant-numeric:tabular-nums;font-weight:500">${v}</span></div>`;
}
function orgNames(t: ChartTheme, names: string[], total: number) {
  if (!names.length) return '';
  const more = total > names.length ? ` 等 ${total} 家` : '';
  return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid ${t.tooltipBorder};color:${t.text2};max-width:260px;white-space:normal">${names.map(escapeHtml).join('、')}${more}</div>`;
}

const option = computed<EChartsOption>(() => {
  void resetKey.value; // 点「复位」时重建 option
  const t = theme.value;
  const f = filtering.value && result.value;
  return {
    tooltip: {
      ...tooltipBase(t),
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string; seriesType?: string; seriesId?: string; data?: { orgs?: string[]; count?: number } };
        if (!p.name) return '';
        const title = `<div style="font-weight:600;font-size:13px;margin-bottom:6px">${escapeHtml(p.name)}</div>`;
        if (p.seriesId === 'ref') return `${title}<div style="color:${t.text3}">这里暂无合作机构的校区</div>`;
        // 筛选模式：城市标点 / 省份
        if (p.seriesType === 'effectScatter' || p.seriesType === 'scatter') {
          const d = p.data!;
          return (
            title +
            row(t, '校区机构', `${num(d.count)} 家`) +
            orgNames(t, d.orgs ?? [], d.count ?? 0) +
            `<div style="margin-top:6px;color:${t.brand};font-size:12px">点击查看这些机构</div>`
          );
        }
        if (f) {
          const a = filterProvinceMap.value.get(p.name);
          if (!a) return `${title}<div style="color:${t.text3}">没有匹配的校区</div>`;
          return (
            title +
            row(t, '有校区的机构', `${num(a.count)} 家`) +
            orgNames(t, a.orgs, a.count) +
            `<div style="margin-top:6px;color:${t.brand};font-size:12px">点击地图上的城市圆点查看机构</div>`
          );
        }
        const s = statByName.value.get(p.name);
        if (!s) return `${title}<div style="color:${t.text3}">暂无合作机构</div>`;
        const cities = s.topCities.length
          ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid ${t.tooltipBorder};color:${t.text3}">主要城市：${s.topCities.map(escapeHtml).join('、')}</div>`
          : '';
        return (
          title +
          row(t, '合作机构', `${num(s.count)} 家`) +
          row(t, '合作中', `${num(s.active)} 家`) +
          (props.finance
            ? row(t, '累计成交', `${num(s.dealCount)} 笔`) + row(t, '累计成交额', money(s.amount)) + row(t, '累计佣金', money(s.commission))
            : '') +
          cities +
          `<div style="margin-top:6px;color:${t.brand};font-size:12px">点击查看该省机构</div>`
        );
      },
    },
    visualMap: {
      type: 'continuous',
      seriesIndex: 0,
      min: 0,
      max: f ? filterMax.value : maxCount.value,
      left: 8,
      bottom: 8,
      itemWidth: 10,
      itemHeight: 90,
      calculable: false,
      text: ['多', '少'],
      textGap: 6,
      textStyle: { color: t.text3, fontSize: 11 },
      inRange: { color: t.mapRange },
      outOfRange: { color: t.mapEmpty },
    },
    geo: {
      map: 'china',
      roam: true,
      scaleLimit: { min: MIN_ZOOM, max: MAX_ZOOM },
      zoom: view.zoom,
      ...(view.center ? { center: view.center } : {}),
      layoutCenter: ['52%', '56%'],
      layoutSize: '112%',
      selectedMode: false,
      // 放大后显示省名
      label: { show: zoomTier.value >= 1, color: t.text3, fontSize: 11 },
      itemStyle: { areaColor: t.mapEmpty, borderColor: t.mapBorder, borderWidth: 0.8 },
      emphasis: {
        label: { show: true, color: t.dark ? '#fff' : t.ink, fontSize: 11, fontWeight: 600 },
        itemStyle: { areaColor: t.accent, borderColor: t.mapBorder, borderWidth: 1 },
      },
    },
    series: [
      {
        type: 'map',
        geoIndex: 0,
        data: f
          ? result.value!.provinces.map((p) => ({ name: p.name, value: p.count }))
          : props.provinces.map((p) => ({ name: p.name, value: p.count })),
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        // 校区城市标点：机构越多点越大
        symbolSize: (v: number[]) => 8 + Math.round((v[2] / maxCityCount.value) * 10),
        rippleEffect: { scale: 2.6, brushType: 'stroke' },
        itemStyle: { color: t.accent, shadowBlur: 6, shadowColor: 'rgba(0,0,0,.25)' },
        label: {
          show: cityPoints.value.length <= 20,
          formatter: '{b}',
          position: 'right',
          fontSize: 11,
          color: t.dark ? '#fff' : t.ink,
        },
        zlevel: 1,
        data: f ? cityPoints.value : [],
      },
      {
        // 平时：所有机构的校区城市
        id: 'orgCities',
        type: 'scatter',
        coordinateSystem: 'geo',
        symbolSize: (v: number[]) => 6 + Math.round((v[2] / maxOrgCityCount.value) * 10) + zoomTier.value * 2,
        itemStyle: { color: t.accent, borderColor: '#fff', borderWidth: 1, shadowBlur: 4, shadowColor: 'rgba(0,0,0,.2)' },
        label: {
          show: zoomTier.value >= 1,
          formatter: (p: { name: string; data: { count: number } }) => `${p.name} ${p.data.count}`,
          position: 'right',
          fontSize: 11,
          fontWeight: 600,
          color: t.dark ? '#fff' : t.ink,
        },
        zlevel: 1,
        data: f ? [] : orgCityPoints.value,
      },
      {
        // 放大后：周边没有机构的城市，灰色小点
        id: 'ref',
        type: 'scatter',
        coordinateSystem: 'geo',
        symbolSize: 4,
        silent: false,
        itemStyle: { color: t.text3, opacity: 0.6 },
        label: { show: zoomTier.value >= 2, formatter: '{b}', position: 'right', fontSize: 10, color: t.text3 },
        data: zoomTier.value >= 1 ? refCityPoints.value : [],
      },
    ],
  } as EChartsOption;
});

function goProvince(name: string) {
  router.push({ name: 'orgs', query: { province: name } });
}

function onMapClick(params: unknown) {
  const p = params as { componentType?: string; seriesType?: string; seriesId?: string; name?: string };
  if (!p.name || p.seriesId === 'ref') return;
  // 平时的机构城市标点：看在这个城市有校区的机构
  if (p.seriesId === 'orgCities') {
    router.push({ name: 'orgs', query: { city: p.name } });
    return;
  }
  // 筛选模式下点城市 / 省份：带上关键词跳到机构列表
  if (p.seriesType === 'effectScatter') {
    router.push({ name: 'orgs', query: { city: p.name, keyword: keyword.value.trim() || undefined, businessType: businessType.value ?? undefined } });
    return;
  }
  // 筛选模式下省份按「校区」统计，和机构列表的省份（按总部）口径不同，所以只响应城市圆点的点击
  if (filtering.value) return;
  if (p.componentType === 'series' && statByName.value.has(p.name)) goProvince(p.name);
}
</script>

<template>
  <div class="card map-card">
    <div class="card-header">
      <div>
        <div class="card-title">机构地区分布</div>
        <div class="card-sub">
          覆盖 <span class="num">{{ coveredProvinces }}</span> 个省级行政区，共
          <span class="num">{{ num(totalOrgs) }}</span> 家机构 · 可放大查看机构周边的城市，点城市圆点看机构
        </div>
      </div>
      <button id="map-view-all" class="link-btn" @click="router.push('/orgs')">
        全部机构 <ArrowRight :size="14" />
      </button>
    </div>

    <div class="map-filter">
      <NInput id="map-search" v-model:value="keyword" size="small" clearable placeholder="搜索机构，如：新东方，在地图上显示它的全部校区" class="map-search">
        <template #prefix><Search :size="14" :stroke-width="1.75" class="text-3" /></template>
      </NInput>
      <NSelect
        id="map-business"
        v-model:value="businessType"
        :options="businessTypeOptions"
        size="small"
        clearable
        filterable
        tag
        placeholder="业务 / 产品类型"
        class="map-sel"
      />
      <span v-if="filtering && result" class="map-filter-hit">
        找到 <strong class="num">{{ result.orgCount }}</strong> 家机构，<strong class="num">{{ result.cities.length }}</strong> 个校区城市
      </span>
      <button v-if="filtering" id="map-filter-clear" class="link-btn" @click="clearFilter">清除</button>
    </div>

    <div class="map-body">
      <div class="map-wrap">
        <NSkeleton v-if="(loading && !filtering) || (!mapReady && !mapError)" class="map-skeleton" />
        <div v-else-if="mapError" class="map-error">
          <MapPin :size="20" :stroke-width="1.75" />
          <span>{{ mapError }}</span>
          <NButton size="small" secondary @click="loadMap">重试</NButton>
        </div>
        <template v-else>
          <EChart :option="option" @chart-click="onMapClick" @ready="onChartReady" />
          <div class="zoom-ctl">
            <button id="map-zoom-in" title="放大" @click="zoomBy(1.6)"><Plus :size="15" /></button>
            <button id="map-zoom-out" title="缩小" @click="zoomBy(1 / 1.6)"><Minus :size="15" /></button>
            <button id="map-zoom-reset" title="复位" @click="resetZoom"><RotateCcw :size="14" /></button>
          </div>
        </template>
      </div>

      <div v-if="filtering" class="rank">
        <div class="rank-title">{{ searching ? '搜索中…' : '匹配的机构' }}</div>
        <div v-if="result && !result.orgs.length && !searching" class="rank-empty text-3">没有匹配的机构</div>
        <ul v-else-if="result" class="hit-list">
          <li v-for="o in result.orgs" :key="o.id">
            <button class="hit-item" :title="o.cities.join('、')" @click="router.push(`/orgs/${o.id}`)">
              <span class="hit-name">{{ o.name }}</span>
              <span class="hit-sub">{{ o.cities.length }} 个校区 · {{ o.cities.slice(0, 4).join('、') }}{{ o.cities.length > 4 ? '…' : '' }}</span>
            </button>
          </li>
        </ul>
        <div v-if="result && result.orgCount > result.orgs.length" class="rank-foot">
          仅列出前 {{ result.orgs.length }} 家，可缩小搜索范围
        </div>
      </div>
      <div v-else class="rank">
        <div class="rank-title">省份排行</div>
        <template v-if="loading">
          <NSkeleton v-for="i in 8" :key="i" text style="height: 18px; margin: 9px 0" />
        </template>
        <ol v-else class="rank-list">
          <li v-for="(p, i) in ranking" :key="p.name">
            <button :id="`rank-${p.name}`" class="rank-item" @click="goProvince(p.name)">
              <span class="rank-no num" :class="{ top: i < 3 }">{{ i + 1 }}</span>
              <span class="rank-name">{{ shortProvinceName(p.name) }}</span>
              <span class="rank-bar"><i :style="{ width: `${(p.count / maxCount) * 100}%` }" /></span>
              <span class="rank-val num">{{ p.count }}</span>
            </button>
          </li>
        </ol>
        <div v-if="!loading && finance && topAmount" class="rank-foot">
          成交额最高：<strong>{{ shortProvinceName(topAmount.name) }}</strong>
          <span class="num">{{ moneyShort(topAmount.amount) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#map-view-all {
  flex-shrink: 0;
  white-space: nowrap;
}
.map-card {
  display: flex;
  flex-direction: column;
}
.map-body {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 8px;
  padding: 4px 20px 16px 8px;
  min-height: 600px;
}
.map-wrap {
  position: relative;
  min-height: 600px;
  overflow: hidden;
}
.zoom-ctl {
  position: absolute;
  right: 8px;
  bottom: 12px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}
.zoom-ctl button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}
.zoom-ctl button + button {
  border-top: 1px solid var(--border);
}
.zoom-ctl button:hover {
  background: var(--neutral-soft);
  color: var(--brand);
}
.map-skeleton {
  position: absolute;
  inset: 12px;
  width: auto;
  height: auto;
  border-radius: 12px;
}
.map-error {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-3);
  font-size: 13px;
}
.rank {
  display: flex;
  flex-direction: column;
  padding: 8px 0 0 16px;
  border-left: 1px solid var(--border);
}
.rank-title {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 6px;
}
.rank-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.rank-item {
  display: grid;
  grid-template-columns: 20px 52px 1fr 28px;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 36px;
  padding: 0 6px;
  margin: 0 -6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s;
}
.rank-item:hover {
  background: var(--neutral-soft);
}
.rank-item:hover .rank-bar i {
  background: var(--brand-hover);
}
.rank-no {
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
}
.rank-no.top {
  color: var(--brand);
  font-weight: 600;
}
.rank-name {
  white-space: nowrap;
}
.rank-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--neutral-soft);
  overflow: hidden;
}
.rank-bar i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--brand);
  transition: width 0.6s var(--ease), background-color 0.15s;
}
.rank-val {
  text-align: right;
  color: var(--text-2);
}
.rank-foot {
  margin-top: auto;
  padding-top: 12px;
  font-size: 12px;
  color: var(--text-3);
  display: flex;
  gap: 6px;
  align-items: baseline;
}
.rank-foot strong {
  color: var(--text);
  font-weight: 600;
}
.map-filter {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 20px 4px;
}
.map-search {
  width: 300px;
  max-width: 100%;
}
.map-sel {
  width: 150px;
}
.map-filter-hit {
  font-size: 12px;
  color: var(--text-3);
}
.map-filter-hit strong {
  color: var(--brand);
  font-weight: 600;
}
.rank-empty {
  font-size: 13px;
  padding: 16px 0;
}
.hit-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 380px;
  overflow-y: auto;
}
.hit-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 7px 6px;
  margin: 0 -6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.hit-item:hover {
  background: var(--neutral-soft);
}
.hit-name {
  font-size: 13px;
  color: var(--text);
  font-weight: 500;
}
.hit-sub {
  font-size: 12px;
  color: var(--text-3);
}
@media (max-width: 720px) {
  .map-body {
    grid-template-columns: 1fr;
    min-height: 0;
  }
  .map-wrap {
    min-height: 420px;
  }
  .rank {
    border-left: 0;
    padding-left: 12px;
  }
}
</style>
