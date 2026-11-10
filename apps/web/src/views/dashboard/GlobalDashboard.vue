<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from 'vue';
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
import StaffOverview from './components/StaffOverview.vue';

const message = useMessage();
/** 成交笔数 / 成交额 / 佣金等经营数据只给管理员看，员工看到的是机构维度的概览 */
const finance = useAuthStore().can(PERM.DASHBOARD_FINANCE);

/** Top 10 卡片自己的时间范围；其余卡片（地图、业务类型、员工的新增机构）与它无关 */
const topRange = ref<DashboardRange>('month');

const summary = shallowRef<DashboardSummary | null>(null);
const trend = shallowRef<TrendPoint[]>([]);
const dist = shallowRef<DashboardDistribution | null>(null);
const lists = shallowRef<DashboardLists | null>(null);

const loadingStatic = ref(true); // 趋势、列表
const loadingDist = ref(true); // 指标卡、分布

async function loadDist() {
  loadingDist.value = true;
  try {
    const [s, d] = await Promise.all([
      summary.value ? Promise.resolve(summary.value) : dashboardApi.summary('month'),
      dashboardApi.distribution(topRange.value),
    ]);
    summary.value = s;
    dist.value = d;
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    loadingDist.value = false;
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
  loadDist();
});
watch(topRange, loadDist);

</script>

<template>
  <div class="page dash">
    <!-- 管理员：经营数据在最上面，机构分布类放到下面 -->
    <template v-if="finance">
      <DealOverview class="ov-top" />

      <section class="grid-12">
        <TrendChart class="span-8 rise-in" style="animation-delay: 40ms" :data="trend" :loading="loadingStatic" />
        <TopOrgs class="span-4 rise-in" style="animation-delay: 80ms" :data="dist?.topOrgs ?? []" v-model:range="topRange" :loading="loadingDist" />

        <DealTable
          class="span-8 rise-in"
          style="animation-delay: 120ms"
          title="待审核成交"
          :sub="summary ? `待审核 ${summary.pendingAuditCount} 笔 · 应收未到账佣金 ${money(summary.receivable.amount)}（${summary.receivable.count} 笔）` : undefined"
          :data="lists?.pendingDeals ?? []"
          :loading="loadingStatic"
        />
        <BusinessDonut class="span-4 rise-in" style="animation-delay: 160ms" :data="dist?.businessTypes ?? []" :loading="loadingDist && !dist" />

        <ChinaMapCard class="span-12 rise-in" style="animation-delay: 200ms" :provinces="dist?.provinces ?? []" :loading="loadingDist && !dist" />
        <IncompleteOrgs class="span-12 rise-in" style="animation-delay: 240ms" :data="lists?.incompleteOrgs ?? []" :loading="loadingStatic" />
      </section>
    </template>

    <!-- 员工：上面是自己的业务数据，下面是机构概况 -->
    <template v-else>
    <StaffOverview />
    <h2 class="sec-title">机构概况</h2>
    <section class="grid-12">
      <StatCard
        class="span-6 rise-in"
        label="合作中机构"
        :value="num(summary?.orgTotal)"
        unit="家"
        :delta="null"
        :loading="loadingDist && !summary"
      />
      <StatCard
        class="span-6 rise-in"
        style="animation-delay: 40ms"
        label="本月新增机构"
        :value="num(summary?.orgNew.value)"
        unit="家"
        :delta="summary?.orgNew.delta"
        :loading="loadingDist && !summary"
      />

      <ChinaMapCard
        class="span-12 rise-in"
        style="animation-delay: 80ms"
        :provinces="dist?.provinces ?? []"
        :loading="loadingDist && !dist"
        :finance="false"
      />
      <BusinessDonut class="span-4 rise-in" style="animation-delay: 120ms" :data="dist?.businessTypes ?? []" :loading="loadingDist && !dist" />
      <IncompleteOrgs class="span-8 rise-in" style="animation-delay: 160ms" :data="lists?.incompleteOrgs ?? []" :loading="loadingStatic" />
    </section>
    </template>
  </div>
</template>

<style scoped>
.ov-top {
  margin-bottom: 16px;
}
.sec-title {
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.01em;
  margin-bottom: 12px;
}
</style>
