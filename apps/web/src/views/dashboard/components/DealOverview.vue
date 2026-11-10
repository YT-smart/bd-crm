<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NSkeleton } from 'naive-ui';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Percent } from 'lucide-vue-next';
import type { DealOverview, DealPeriodStat } from '@bdcrm/shared';
import { dealApi } from '@/api';
import EChart from '@/components/EChart.vue';
import type { EChartsOption } from '@/plugins/echarts';
import { tooltipBase, useChartTheme } from '@/composables/useChartTheme';
import { money, moneyShort, num } from '@/utils/format';

/**
 * 成交概览（仅管理员）：今日 / 本周 / 本月成交与上期同期对比、成交率、近 30 天走势。
 * 点击时间段卡片跳转到「成交与结算」，并筛选到对应日期范围。
 */
const router = useRouter();
function pick(range: [string, string]) {
  router.push({ name: 'deals', query: { start: range[0], end: range[1] } });
}

const data = ref<DealOverview | null>(null);
const loading = ref(true);
async function load() {
  try {
    data.value = await dealApi.overview();
  } catch {
    /* 概览加载失败不影响列表 */
  } finally {
    loading.value = false;
  }
}
onMounted(load);
defineExpose({ reload: load });

/** 环比（%）；上期为 0 时不显示 */
function delta(cur: number, prev: number) {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

interface PeriodCard {
  key: string;
  label: string;
  cmp: string;
  cur: DealPeriodStat;
  prev: DealPeriodStat;
  range: [string, string];
}
const periods = computed<PeriodCard[]>(() => {
  const d = data.value;
  if (!d) return [];
  const today = d.ranges.today;
  return [
    { key: 'today', label: '今日成交', cmp: '较昨日同时段', cur: d.today, prev: d.yesterday, range: [today, today] },
    { key: 'week', label: '本周成交', cmp: '较上周同期', cur: d.week, prev: d.lastWeek, range: [d.ranges.weekStart, today] },
    { key: 'month', label: '本月成交', cmp: '较上月同期', cur: d.month, prev: d.lastMonth, range: [d.ranges.monthStart, today] },
  ];
});

/** 成交率变化（百分点） */
const rateDiff = computed(() => {
  const d = data.value;
  if (!d || d.month.rate === null || d.lastMonth.rate === null) return null;
  return Math.round((d.month.rate - d.lastMonth.rate) * 10) / 10;
});

/* ---------- 近 30 天走势 ---------- */
const theme = useChartTheme();
const totals30 = computed(() => {
  const list = data.value?.daily ?? [];
  const count = list.reduce((s, x) => s + x.count, 0);
  const settled = list.reduce((s, x) => s + x.settled, 0);
  return {
    count,
    settled,
    amount: list.reduce((s, x) => s + x.amount, 0),
    rate: count ? Math.round((settled / count) * 1000) / 10 : null,
  };
});

const option = computed<EChartsOption>(() => {
  const t = theme.value;
  const list = data.value?.daily ?? [];
  const axisLabel = { color: t.text3, fontSize: 11 };
  return {
    animationDuration: 600,
    grid: { left: 4, right: 4, top: 28, bottom: 0, containLabel: true },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: t.text3, fontSize: 12 },
      data: ['已结算笔数', '成交笔数', '成交额'],
    },
    tooltip: {
      ...tooltipBase(t),
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: t.dark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)' } },
      formatter: (params: unknown) => {
        const i = (params as { dataIndex: number }[])[0]?.dataIndex ?? 0;
        const x = list[i];
        if (!x) return '';
        const row = (k: string, v: string) =>
          `<div style="display:flex;justify-content:space-between;gap:24px;line-height:1.9"><span style="color:${t.text3}">${k}</span><b style="font-weight:500;font-variant-numeric:tabular-nums">${v}</b></div>`;
        const [, m, dd] = x.date.split('-');
        const wd = '日一二三四五六'[new Date(`${x.date}T00:00:00`).getDay()];
        return (
          `<div style="font-weight:600;margin-bottom:4px">${Number(m)} 月 ${Number(dd)} 日 周${wd}</div>` +
          row('成交', `${x.count} 笔`) +
          row('已结算', `${x.settled} 笔`) +
          row('成交率', x.rate === null ? '--' : `${x.rate}%`) +
          row('成交额', money(x.amount)) +
          row('佣金', money(x.commission))
        );
      },
    },
    xAxis: {
      type: 'category',
      data: list.map((x) => x.date.slice(5).replace('-', '/')),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: t.axisLine } },
      axisLabel: { ...axisLabel, interval: 'auto' },
    },
    yAxis: [
      { type: 'value', minInterval: 1, axisLabel, splitLine: { lineStyle: { color: t.splitLine } } },
      {
        type: 'value',
        axisLabel: { ...axisLabel, formatter: (v: number) => (v >= 10000 ? `${Math.round(v / 10000)}万` : `${v}`) },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '成交笔数',
        type: 'bar',
        barGap: '-100%',
        barMaxWidth: 18,
        data: list.map((x) => x.count),
        itemStyle: { color: t.brandSoft, borderRadius: [3, 3, 0, 0] },
        z: 1,
      },
      {
        name: '已结算笔数',
        type: 'bar',
        barMaxWidth: 18,
        data: list.map((x) => x.settled),
        itemStyle: { color: t.brand, borderRadius: [3, 3, 0, 0] },
        z: 2,
      },
      {
        name: '成交额',
        type: 'line',
        yAxisIndex: 1,
        smooth: 0.35,
        symbol: 'circle',
        symbolSize: 5,
        showSymbol: false,
        data: list.map((x) => x.amount),
        lineStyle: { width: 2, color: t.ink },
        itemStyle: { color: t.ink, borderColor: t.surface, borderWidth: 2 },
      },
    ],
  };
});
</script>

<template>
  <section class="ov rise-in">
    <div class="ov-cards">
      <template v-if="loading && !data">
        <div v-for="i in 4" :key="i" class="card ov-card"><NSkeleton text :repeat="3" /></div>
      </template>
      <template v-else-if="data">
        <button
          v-for="p in periods"
          :id="`deal-ov-${p.key}`"
          :key="p.key"
          type="button"
          class="card ov-card clickable"
          title="点击查看该时间段的成交明细"
          @click="pick(p.range)"
        >
          <div class="ov-head">
            <span class="ov-label">{{ p.label }}</span>
            <CalendarDays :size="14" :stroke-width="1.75" class="ov-ic" />
          </div>
          <div class="ov-main">
            <span class="ov-value num">{{ num(p.cur.count) }}</span><span class="ov-unit">笔</span>
            <span
              v-if="delta(p.cur.count, p.prev.count) !== null"
              :class="['delta', delta(p.cur.count, p.prev.count)! >= 0 ? 'up' : 'down']"
              :title="`${p.cmp}：${p.prev.count} 笔`"
            >
              <component :is="delta(p.cur.count, p.prev.count)! >= 0 ? ArrowUpRight : ArrowDownRight" :size="12" :stroke-width="2" />
              <span class="num">{{ Math.abs(delta(p.cur.count, p.prev.count)!) }}%</span>
            </span>
          </div>
          <div class="ov-rows">
            <div><span>成交额</span><b class="num" :title="money(p.cur.amount)">{{ moneyShort(p.cur.amount) }}</b></div>
            <div><span>佣金</span><b class="num" :title="money(p.cur.commission)">{{ moneyShort(p.cur.commission) }}</b></div>
            <div>
              <span>成交率</span>
              <b class="num">{{ p.cur.rate === null ? '--' : `${p.cur.rate}%` }}</b>
            </div>
          </div>
          <div class="ov-foot">已结算 {{ p.cur.settled }} 笔 · {{ p.cmp }} {{ p.prev.count }} 笔</div>
        </button>

        <div class="card ov-card rate-card">
          <div class="ov-head">
            <span class="ov-label">本月成交率</span>
            <Percent :size="14" :stroke-width="1.75" class="ov-ic" />
          </div>
          <div class="ov-main">
            <span class="ov-value num">{{ data.month.rate === null ? '--' : data.month.rate }}</span>
            <span v-if="data.month.rate !== null" class="ov-unit">%</span>
            <span
              v-if="rateDiff !== null"
              :class="['delta', rateDiff >= 0 ? 'up' : 'down']"
              :title="`上月同期 ${data.lastMonth.rate}%`"
            >
              <component :is="rateDiff >= 0 ? ArrowUpRight : ArrowDownRight" :size="12" :stroke-width="2" />
              <span class="num">{{ Math.abs(rateDiff) }} 个点</span>
            </span>
          </div>
          <div class="rate-bar"><i :style="{ width: `${data.month.rate ?? 0}%` }" /></div>
          <div class="ov-rows">
            <div><span>本月</span><b class="num">{{ data.month.settled }} / {{ data.month.count }} 笔</b></div>
            <div><span>累计成交率</span><b class="num">{{ data.all.rate === null ? '--' : `${data.all.rate}%` }}</b></div>
            <div><span>累计</span><b class="num">{{ num(data.all.settled) }} / {{ num(data.all.count) }} 笔</b></div>
          </div>
          <div class="ov-foot">成交率 = 已结算 ÷ 录入的成交</div>
        </div>
      </template>
    </div>

    <div v-if="data" class="card ov-trend">
      <div class="card-header">
        <div>
          <div class="card-title">近 30 天成交走势</div>
          <div class="card-sub">
            成交 <span class="num">{{ num(totals30.count) }}</span> 笔 · 已结算
            <span class="num">{{ num(totals30.settled) }}</span> 笔 · 成交率
            <span class="num">{{ totals30.rate === null ? '--' : `${totals30.rate}%` }}</span> · 成交额
            <span class="num">{{ money(totals30.amount) }}</span>
          </div>
        </div>
      </div>
      <div class="ov-chart"><EChart :option="option" /></div>
    </div>
  </section>
</template>

<style scoped>
.ov {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.ov-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.ov-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px 14px;
  text-align: left;
  font: inherit;
  color: inherit;
  min-width: 0;
}
.ov-card.clickable {
  cursor: pointer;
  transition: border-color 0.15s var(--ease), box-shadow 0.15s var(--ease);
}
.ov-card.clickable:hover {
  border-color: var(--brand);
  box-shadow: 0 6px 18px -8px rgba(59, 91, 219, 0.35);
}
.ov-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ov-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-2);
}
.ov-ic {
  color: var(--text-3);
}
.ov-main {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex-wrap: wrap;
}
.ov-value {
  font-size: 28px;
  line-height: 1.15;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--text);
}
.ov-unit {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin-right: 6px;
}
.delta {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 20px;
  padding: 0 6px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  align-self: center;
}
.delta.up {
  color: var(--success);
  background: var(--success-soft);
}
.delta.down {
  color: var(--danger);
  background: var(--danger-soft);
}
.ov-rows {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 13px;
}
.ov-rows > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.ov-rows span {
  color: var(--text-3);
}
.ov-rows b {
  font-weight: 500;
  color: var(--text);
}
.ov-foot {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
  color: var(--text-3);
}
.rate-bar {
  height: 6px;
  border-radius: 99px;
  background: var(--neutral-soft);
  overflow: hidden;
}
.rate-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--brand);
  transition: width 0.6s var(--ease);
}
.ov-trend {
  padding-bottom: 12px;
}
.ov-chart {
  height: 220px;
  padding: 0 16px;
}
@media (max-width: 1100px) {
  .ov-cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .ov-cards {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
