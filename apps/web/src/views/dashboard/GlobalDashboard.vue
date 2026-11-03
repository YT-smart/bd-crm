<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useMessage } from 'naive-ui';
import type { DashboardDistribution, DashboardLists, DashboardRange, DashboardSummary, TrendPoint } from '@bdcrm/shared';
import { dashboardApi } from '@/api';
import { ApiError } from '@/api/http';
import { money, num } from '@/utils/format';
import StatCard from './components/StatCard.vue';
import ChinaMapCard from './components/ChinaMapCard.vue';
import TrendChart from './components/TrendChart.vue';
import BusinessDonut from './components/BusinessDonut.vue';
import TopOrgs from './components/TopOrgs.vue';
import DealTable from './components/DealTable.vue';
import IncompleteOrgs from './components/IncompleteOrgs.vue';

const message = useMessage();

const RANGES: { value: DashboardRange; label: string; period: string }[] = [
  { value: 'month', label: '本月', period: '本月' },
  { value: 'quarter', label: '本季度', period: '本季度' },
  { value: 'year', label: '本年', period: '本年' },
];

const range = ref<DashboardRange>('month');
const rangeLabel = computed(() => RANGES.find((r) => r.value === range.value)!.period);

const summary = shallowRef<DashboardSummary | null>(null);
const trend = shallowRef<TrendPoint[]>([]);
const dist = shallowRef<DashboardDistribution | null>(null);
const lists = shallowRef<DashboardLists | null>(null);

const loadingStatic = ref(true); // 趋势、列表（与时间范围无关）
const loadingRange = ref(true); // 指标卡、分布

async function loadRange() {
  loadingRange.value = true;
  try {
    const [s, d] = await Promise.all([dashboardApi.summary(range.value), dashboardApi.distribution(range.value)]);
    summary.value = s;
    dist.value = d;
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    loadingRange.value = false;
  }
}

async function loadStatic() {
  loadingStatic.value = true;
  try {
    const [t, l] = await Promise.all([dashboardApi.trend(), dashboardApi.lists()]);
    trend.value = t;
    lists.value = l;
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    loadingStatic.value = false;
  }
}

onMounted(() => {
  loadStatic();
  loadRange();
});
watch(range, loadRange);

/** 迷你趋势：区间为「本年」时用全部 12 个月，否则用近 6 个月，更能看出短期走势 */
const sparkLen = computed(() => (range.value === 'year' ? 12 : 6));
const spark = (pick: (t: TrendPoint) => number) => trend.value.slice(-sparkLen.value).map(pick);
const orgSpark = computed(() => {
  // 机构数用累计值
  let acc = (summary.value?.orgTotal ?? 0) - trend.value.reduce((s, t) => s + t.newOrgs, 0);
  return trend.value.map((t) => (acc += t.newOrgs)).slice(-sparkLen.value);
});
</script>

<template>
  <div class="page dash">
    <Teleport to="#header-actions" defer>
      <div class="segmented" role="tablist" aria-label="时间范围">
        <button
          v-for="r in RANGES"
          :id="`range-${r.value}`"
          :key="r.value"
          role="tab"
          :aria-selected="range === r.value"
          :class="{ active: range === r.value }"
          @click="range = r.value"
        >
          {{ r.label }}
        </button>
      </div>
    </Teleport>

    <section class="grid-12">
      <StatCard
        class="span-3 rise-in"
        label="合作机构"
        :value="num(summary?.orgTotal)"
        :note="`${rangeLabel}新增 ${summary?.orgNew.value ?? 0} 家`"
        :delta="null"
        :spark="orgSpark"
        :loading="loadingRange && !summary"
      />
      <StatCard
        class="span-3 rise-in"
        style="animation-delay: 40ms"
        :label="`${rangeLabel}成交`"
        :value="num(summary?.dealCount.value)"
        unit="笔"
        :delta="summary?.dealCount.delta"
        :spark="spark((t) => t.dealCount)"
        :loading="loadingRange && !summary"
      />
      <StatCard
        class="span-3 rise-in"
        style="animation-delay: 80ms"
        :label="`${rangeLabel}成交额`"
        :value="money(summary?.dealAmount.value)"
        :delta="summary?.dealAmount.delta"
        :spark="spark((t) => t.amount)"
        :loading="loadingRange && !summary"
      />
      <StatCard
        class="span-3 rise-in"
        style="animation-delay: 120ms"
        :label="`${rangeLabel}佣金收入`"
        :value="money(summary?.commissionIncome.value)"
        :delta="summary?.commissionIncome.delta"
        :spark="spark((t) => t.settled)"
        :loading="loadingRange && !summary"
      />

      <ChinaMapCard class="span-8 rise-in" style="animation-delay: 160ms" :provinces="dist?.provinces ?? []" :loading="loadingRange && !dist" />
      <BusinessDonut class="span-4 rise-in" style="animation-delay: 200ms" :data="dist?.businessTypes ?? []" :loading="loadingRange && !dist" />

      <TrendChart class="span-8 rise-in" style="animation-delay: 240ms" :data="trend" :loading="loadingStatic" />
      <TopOrgs class="span-4 rise-in" style="animation-delay: 280ms" :data="dist?.topOrgs ?? []" :range-label="rangeLabel" :loading="loadingRange && !dist" />

      <DealTable
        class="span-8 rise-in"
        style="animation-delay: 320ms"
        title="待审核成交"
        :sub="summary ? `待审核 ${summary.pendingAuditCount} 笔 · 应收未到账佣金 ${money(summary.receivable.amount)}（${summary.receivable.count} 笔）` : undefined"
        :data="lists?.pendingDeals ?? []"
        :loading="loadingStatic"
      />
      <IncompleteOrgs class="span-4 rise-in" style="animation-delay: 360ms" :data="lists?.incompleteOrgs ?? []" :loading="loadingStatic" />
    </section>
  </div>
</template>
