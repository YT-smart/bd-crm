<script setup lang="ts">
import { computed } from 'vue';
import { NSkeleton } from 'naive-ui';
import { ArrowDownRight, ArrowUpRight } from 'lucide-vue-next';
import EChart from '@/components/EChart.vue';
import type { EChartsOption } from '@/plugins/echarts';
import { useChartTheme } from '@/composables/useChartTheme';

const props = defineProps<{
  label: string;
  value: string;
  unit?: string;
  /** 环比百分比；null 表示上期无数据 */
  delta?: number | null;
  /** 不显示环比时的补充说明 */
  note?: string;
  spark?: number[];
  loading?: boolean;
}>();

const theme = useChartTheme();

const sparkOption = computed<EChartsOption>(() => {
  const t = theme.value;
  return {
    animationDuration: 600,
    grid: { left: 0, right: 0, top: 4, bottom: 2 },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: (props.spark ?? []).map((_, i) => i) },
    yAxis: { type: 'value', show: false, scale: true },
    series: [
      {
        type: 'line',
        data: props.spark ?? [],
        smooth: 0.4,
        symbol: 'none',
        lineStyle: { width: 1.75, color: t.brand },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: t.brandSoft },
              { offset: 1, color: 'rgba(0,0,0,0)' },
            ],
          },
        },
      },
    ],
  };
});

const tone = computed(() => {
  if (props.delta == null) return 'none';
  return props.delta >= 0 ? 'up' : 'down';
});
</script>

<template>
  <div class="card stat">
    <div class="stat-label">{{ label }}</div>
    <template v-if="loading">
      <NSkeleton text style="width: 60%; height: 30px; margin: 8px 0 10px" />
      <NSkeleton text style="width: 40%" />
    </template>
    <template v-else>
      <div class="stat-value num">
        {{ value }}<span v-if="unit" class="stat-unit">{{ unit }}</span>
      </div>
      <div class="stat-foot">
        <span v-if="tone !== 'none'" class="delta" :class="tone">
          <component :is="tone === 'up' ? ArrowUpRight : ArrowDownRight" :size="13" :stroke-width="2" />
          <span class="num">{{ Math.abs(delta!).toFixed(2) }}%</span>
        </span>
        <span class="stat-note">{{ note ?? (tone === 'none' ? '上期无数据' : '较上期') }}</span>
        <div v-if="spark?.length" class="stat-spark">
          <EChart :option="sparkOption" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stat {
  position: relative;
  padding: 18px 20px 16px;
  min-height: 132px;
  overflow: hidden;
  transition: border-color 0.2s var(--ease), transform 0.2s var(--ease);
}
.stat:hover {
  border-color: var(--border-strong);
}
.stat-label {
  font-size: 14px;
  color: var(--text-2);
  font-weight: 500;
}
.stat-value {
  margin-top: 8px;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--text);
}
.stat-unit {
  margin-left: 4px;
  font-size: 18px;
  font-weight: 600;
}
.stat-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  min-height: 32px;
  font-size: 12px;
  position: relative;
  z-index: 1;
}
.delta {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 22px;
  padding: 0 6px;
  border-radius: 6px;
  font-weight: 500;
}
.delta.up {
  color: var(--success);
  background: var(--success-soft);
}
.delta.down {
  color: var(--danger);
  background: var(--danger-soft);
}
.stat-note {
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.stat-spark {
  flex-shrink: 0;
  margin-left: auto;
  width: 88px;
  height: 32px;
}
</style>
