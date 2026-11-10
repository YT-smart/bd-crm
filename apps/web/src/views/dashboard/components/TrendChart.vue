<script setup lang="ts">
import { computed } from 'vue';
import { NSkeleton } from 'naive-ui';
import type { TrendPoint } from '@bdcrm/shared';
import EChart from '@/components/EChart.vue';
import type { EChartsOption } from '@/plugins/echarts';
import { tooltipBase, useChartTheme } from '@/composables/useChartTheme';
import { money, monthLabel, num } from '@/utils/format';

const props = defineProps<{ data: TrendPoint[]; loading?: boolean; title?: string }>();
const theme = useChartTheme();

const totals = computed(() => ({
  amount: props.data.reduce((s, d) => s + d.amount, 0),
  commission: props.data.reduce((s, d) => s + d.commission, 0),
  count: props.data.reduce((s, d) => s + d.dealCount, 0),
}));

const wan = (v: number) => (v >= 10000 ? `${Math.round(v / 10000)}万` : `${v}`);

const option = computed<EChartsOption>(() => {
  const t = theme.value;
  const axisLabel = { color: t.text3, fontSize: 11 };
  return {
    animationDuration: 700,
    grid: { left: 8, right: 8, top: 36, bottom: 4, containLabel: true },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
      textStyle: { color: t.text2, fontSize: 12 },
      data: [
        { name: '成交额', icon: 'roundRect' },
        { name: '佣金', icon: 'circle' },
      ],
    },
    tooltip: {
      ...tooltipBase(t),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: t.dark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)' } },
      formatter: (params: unknown) => {
        const list = params as { dataIndex: number }[];
        const d = props.data[list[0]?.dataIndex ?? 0];
        if (!d) return '';
        const row = (k: string, v: string, c: string) =>
          `<div style="display:flex;align-items:center;gap:8px;line-height:1.9"><i style="width:8px;height:8px;border-radius:2px;background:${c}"></i><span style="color:${t.text3};flex:1">${k}</span><b style="font-weight:500;font-variant-numeric:tabular-nums;margin-left:20px">${v}</b></div>`;
        return (
          `<div style="font-weight:600;margin-bottom:4px">${d.month.replace('-', ' 年 ')} 月</div>` +
          row('成交额', money(d.amount), t.brand) +
          row('佣金', money(d.commission), t.ink) +
          row('成交笔数', `${num(d.dealCount)} 笔`, t.text3)
        );
      },
    },
    xAxis: {
      type: 'category',
      data: props.data.map((d) => monthLabel(d.month)),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: t.axisLine } },
      axisLabel,
    },
    yAxis: [
      {
        type: 'value',
        axisLabel: { ...axisLabel, formatter: (v: number) => wan(v) },
        splitLine: { lineStyle: { color: t.splitLine } },
      },
      {
        type: 'value',
        axisLabel: { ...axisLabel, formatter: (v: number) => wan(v) },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '成交额',
        type: 'bar',
        barMaxWidth: 28,
        data: props.data.map((d) => d.amount),
        itemStyle: { color: t.brand, borderRadius: [4, 4, 0, 0] },
        emphasis: { itemStyle: { color: t.dark ? '#748FFC' : '#4C6EF5' } },
      },
      {
        name: '佣金',
        type: 'line',
        yAxisIndex: 1,
        smooth: 0.35,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: false,
        data: props.data.map((d) => d.commission),
        lineStyle: { width: 2, color: t.ink },
        itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 2 },
      },
    ],
  };
});
</script>

<template>
  <div class="card">
    <div class="card-header">
      <div>
        <div class="card-title">{{ title ?? '成交额与佣金趋势' }}</div>
        <div class="card-sub">
          近 12 个月 · 成交 <span class="num">{{ num(totals.count) }}</span> 笔 · 成交额
          <span class="num">{{ money(totals.amount) }}</span> · 佣金 <span class="num">{{ money(totals.commission) }}</span>
        </div>
      </div>
    </div>
    <div class="card-body chart-body">
      <NSkeleton v-if="loading" style="height: 100%; border-radius: 8px" />
      <EChart v-else :option="option" />
    </div>
  </div>
</template>

<style scoped>
.chart-body {
  height: 340px;
}
</style>
