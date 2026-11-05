<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NSkeleton } from 'naive-ui';
import { ArrowRight, MapPin } from 'lucide-vue-next';
import { shortProvinceName, type ProvinceStat } from '@bdcrm/shared';
import EChart from '@/components/EChart.vue';
import { ensureChinaMap, type EChartsOption } from '@/plugins/echarts';
import { tooltipBase, useChartTheme } from '@/composables/useChartTheme';
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
onMounted(loadMap);

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

const option = computed<EChartsOption>(() => {
  const t = theme.value;
  return {
    tooltip: {
      ...tooltipBase(t),
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name: string };
        if (!p.name) return '';
        const s = statByName.value.get(p.name);
        const title = `<div style="font-weight:600;font-size:13px;margin-bottom:6px">${escapeHtml(p.name)}</div>`;
        if (!s) return `${title}<div style="color:${t.text3}">暂无合作机构</div>`;
        const row = (k: string, v: string) =>
          `<div style="display:flex;justify-content:space-between;gap:24px;line-height:1.9"><span style="color:${t.text3}">${k}</span><span style="font-variant-numeric:tabular-nums;font-weight:500">${v}</span></div>`;
        const cities = s.topCities.length
          ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid ${t.tooltipBorder};color:${t.text3}">主要城市：${s.topCities.map(escapeHtml).join('、')}</div>`
          : '';
        return (
          title +
          row('合作机构', `${num(s.count)} 家`) +
          row('合作中', `${num(s.active)} 家`) +
          (props.finance
            ? row('累计成交', `${num(s.dealCount)} 笔`) + row('累计成交额', money(s.amount)) + row('累计佣金', money(s.commission))
            : '') +
          cities +
          `<div style="margin-top:6px;color:${t.brand};font-size:12px">点击查看该省机构</div>`
        );
      },
    },
    visualMap: {
      type: 'continuous',
      min: 0,
      max: maxCount.value,
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
    series: [
      {
        type: 'map',
        map: 'china',
        roam: false,
        layoutCenter: ['52%', '58%'],
        layoutSize: '118%',
        selectedMode: false,
        label: { show: false },
        itemStyle: {
          areaColor: t.mapEmpty,
          borderColor: t.mapBorder,
          borderWidth: 0.8,
        },
        emphasis: {
          label: { show: true, color: t.dark ? '#fff' : t.ink, fontSize: 11, fontWeight: 600 },
          itemStyle: { areaColor: t.accent, borderColor: t.mapBorder, borderWidth: 1 },
        },
        data: props.provinces.map((p) => ({ name: p.name, value: p.count })),
      },
    ],
  };
});

function goProvince(name: string) {
  router.push({ name: 'orgs', query: { province: name } });
}

function onMapClick(params: unknown) {
  const p = params as { componentType?: string; name?: string };
  if (p.componentType === 'series' && p.name && statByName.value.has(p.name)) goProvince(p.name);
}
</script>

<template>
  <div class="card map-card">
    <div class="card-header">
      <div>
        <div class="card-title">机构地区分布</div>
        <div class="card-sub">
          覆盖 <span class="num">{{ coveredProvinces }}</span> 个省级行政区，共
          <span class="num">{{ num(totalOrgs) }}</span> 家机构 · 悬停查看数据，点击省份查看机构
        </div>
      </div>
      <button id="map-view-all" class="link-btn" @click="router.push('/orgs')">
        全部机构 <ArrowRight :size="14" />
      </button>
    </div>

    <div class="map-body">
      <div class="map-wrap">
        <NSkeleton v-if="loading || (!mapReady && !mapError)" class="map-skeleton" />
        <div v-else-if="mapError" class="map-error">
          <MapPin :size="20" :stroke-width="1.75" />
          <span>{{ mapError }}</span>
          <NButton size="small" secondary @click="loadMap">重试</NButton>
        </div>
        <EChart v-else :option="option" @chart-click="onMapClick" />
      </div>

      <div class="rank">
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
  min-height: 420px;
}
.map-wrap {
  position: relative;
  min-height: 420px;
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
@media (max-width: 720px) {
  .map-body {
    grid-template-columns: 1fr;
  }
  .rank {
    border-left: 0;
    padding-left: 12px;
  }
}
</style>
