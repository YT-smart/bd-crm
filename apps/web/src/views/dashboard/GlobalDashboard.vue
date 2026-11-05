<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useMessage } from 'naive-ui';
import { PERM, type DashboardDistribution, DashboardLists, DashboardRange, DashboardSummary, TrendPoint } from '@bdcrm/shared';
import { dashboardApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { ApiError } from '@/api/http';
import { money, num } from '@/utils/format';
import StatCard from './components/StatCard.vue';
import ChinaMapCard from './components/ChinaMapCard.vue';
import TrendChart from './components/TrendChart.vue';
import BusinessDonut from './components/BusinessDonut.vue';
import TopOrgs from './components/TopOrgs.vue';
import DealTable from './components/DealTable.vue';
import IncompleteOrgs from './components/IncompleteOrgs.vue';
import DealOverview from './components/DealOverview.vue';

const message = useMessage();
/** 成交笔数 / 成交额 / 佣金等经营数据只给管理员看，员工看到的是机构维度的概览 */
const finance = useAuthStore().can(PERM.DASHBOARD_FINANCE);

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
    const [t, l] = await Promise.all([finance ? dashboardApi.trend() : Promise.resolve([]), dashboardApi.lists()]);
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

    <!-- 管理员：经营数据在最上面，机构分布类放到下面 -->
    <template v-if="finance">
      <DealOverview class="ov-top" />

      <section class="grid-12">
        <TrendChart class="span-8 rise-in" style="animation-delay: 40ms" :data="trend" :loading="loadingStatic" />
        <TopOrgs class="span-4 rise-in" style="animation-delay: 80ms" :data="dist?.topOrgs ?? []" :range-label="rangeLabel" :loading="loadingRange && !dist" />

        <DealTable
          class="span-8 rise-in"
          style="animation-delay: 120ms"
          title="待审核成交"
          :sub="summary ? `待审核 ${summary.pendingAuditCount} 笔 · 应收未到账佣金 ${money(summary.receivable.amount)}（${summary.receivable.count} 笔）` : undefined"
          :data="lists?.pendingDeals ?? []"
          :loading="loadingStatic"
        />
        <IncompleteOrgs class="span-4 rise-in" style="animation-delay: 160ms" :data="lists?.incompleteOrgs ?? []" :loading="loadingStatic" />

        <ChinaMapCard class="span-8 rise-in" style="animation-delay: 200ms" :provinces="dist?.provinces ?? []" :loading="loadingRange && !dist" />
        <BusinessDonut class="span-4 rise-in" style="animation-delay: 240ms" :data="dist?.businessTypes ?? []" :loading="loadingRange && !dist" />
      </section>
    </template>

    <!-- 员工：只看机构维度，不展示成交、成交额、佣金 -->
    <section v-else class="grid-12">
      <StatCard
        class="span-6 rise-in"
        label="合作中机构"
        :value="num(summary?.orgTotal)"
        unit="家"
        :delta="null"
        :loading="loadingRange && !summary"
      />
      <StatCard
        class="span-6 rise-in"
        style="animation-delay: 40ms"
        :label="`${rangeLabel}新增机构`"
        :value="num(summary?.orgNew.value)"
        unit="家"
        :delta="summary?.orgNew.delta"
        :loading="loadingRange && !summary"
      />

      <ChinaMapCard
        class="span-8 rise-in"
        style="animation-delay: 80ms"
        :provinces="dist?.provinces ?? []"
        :loading="loadingRange && !dist"
        :finance="false"
      />
      <BusinessDonut class="span-4 rise-in" style="animation-delay: 120ms" :data="dist?.businessTypes ?? []" :loading="loadingRange && !dist" />

      <IncompleteOrgs class="span-12 rise-in" style="animation-delay: 160ms" :data="lists?.incompleteOrgs ?? []" :loading="loadingStatic" />
    </section>
  </div>
</template>

<style scoped>
.ov-top {
  margin-bottom: 16px;
}
</style>
