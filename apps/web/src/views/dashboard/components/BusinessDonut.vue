<script setup lang="ts">
import { computed } from 'vue';
import { NSkeleton } from 'naive-ui';
import type { NameValue } from '@bdcrm/shared';
import EChart from '@/components/EChart.vue';
import type { EChartsOption } from '@/plugins/echarts';
import { tooltipBase, useChartTheme } from '@/composables/useChartTheme';

const props = defineProps<{ data: NameValue[]; loading?: boolean }>();
const theme = useChartTheme();

const total = computed(() => props.data.reduce((s, d) => s + d.value, 0));

const option = computed<EChartsOption>(() => {
  const t = theme.value;
  return {
    color: t.series,
    tooltip: {
      ...tooltipBase(t),
      trigger: 'item',
      formatter: '{b}<br/><b style="font-variant-numeric:tabular-nums">{c}</b> 家 · {d}%',
    },
    series: [
      {
        type: 'pie',
        radius: ['62%', '84%'],
        center: ['50%', '50%'],
        padAngle: 2,
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: t.surface, borderWidth: 2 },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 4 },
        data: props.data,
      },
    ],
  };
});
</script>

<template>
  <div class="card donut-card">
    <div class="card-header">
      <div>
        <div class="card-title">业务类型占比</div>
        <div class="card-sub">按机构开展的业务统计，一家机构可覆盖多类</div>
      </div>
    </div>
    <div class="card-body donut-body">
      <NSkeleton v-if="loading" circle style="width: 180px; height: 180px; margin: 20px auto" />
      <template v-else>
        <div class="donut">
          <EChart :option="option" />
          <div class="donut-center">
            <div class="donut-total num">{{ total }}</div>
            <div class="donut-label">业务覆盖</div>
          </div>
        </div>
        <ul class="legend">
          <li v-for="(d, i) in data" :key="d.name">
            <i :style="{ background: theme.series[i % theme.series.length] }" />
            <span class="legend-name">{{ d.name }}</span>
            <span class="legend-val num">{{ d.value }}</span>
            <span class="legend-pct num">{{ total ? ((d.value / total) * 100).toFixed(0) : 0 }}%</span>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>

<style scoped>
.donut-card {
  display: flex;
  flex-direction: column;
}
.donut-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.donut {
  position: relative;
  height: 200px;
}
.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.donut-total {
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.donut-label {
  font-size: 12px;
  color: var(--text-3);
}
.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 2px;
}
.legend li {
  display: grid;
  grid-template-columns: 10px 1fr auto 40px;
  align-items: center;
  gap: 10px;
  height: 30px;
  font-size: 13px;
}
.legend i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
.legend-name {
  color: var(--text);
}
.legend-val {
  color: var(--text-2);
}
.legend-pct {
  color: var(--text-3);
  text-align: right;
}
</style>
