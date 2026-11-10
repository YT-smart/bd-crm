<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NSkeleton, useMessage } from 'naive-ui';
import { ArrowRight, BellRing } from 'lucide-vue-next';
import { LEAD_PUSH_STATUS, type DashboardRange, type StaffDashboard } from '@bdcrm/shared';
import { dashboardApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { money, moneyShort, num } from '@/utils/format';
import StatCard from './StatCard.vue';
import TrendChart from './TrendChart.vue';
import TopOrgs from './TopOrgs.vue';
import DealTable from './DealTable.vue';

/** 员工仪表盘「我的业务」：自己的成交、佣金和线索 */
const router = useRouter();
const message = useMessage();
const auth = useAuthStore();

const RANGES: { value: DashboardRange; label: string; cmp: string }[] = [
  { value: 'month', label: '本月', cmp: '上月同期' },
  { value: 'quarter', label: '本季度', cmp: '上季度同期' },
  { value: 'year', label: '本年', cmp: '去年同期' },
];
const range = ref<DashboardRange>('month');
const rangeLabel = computed(() => RANGES.find((r) => r.value === range.value)!.label);

const data = shallowRef<StaffDashboard | null>(null);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    data.value = await dashboardApi.me(range.value);
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(range, load);

const first = computed(() => loading.value && !data.value);
const trend = computed(() => data.value?.trend ?? []);

/* 线索：各推出状态占比 */
const leadRows = computed(() => {
  const l = data.value?.leads;
  if (!l) return [];
  return LEAD_PUSH_STATUS.map((s) => ({ name: s, count: l.byStatus[s] ?? 0, pct: l.total ? ((l.byStatus[s] ?? 0) / l.total) * 100 : 0 }));
});
const signRate = computed(() => {
  const l = data.value?.leads;
  if (!l?.total) return null;
  return Math.round(((l.byStatus['已签约'] ?? 0) / l.total) * 1000) / 10;
});
</script>

<template>
  <section class="staff-ov">
    <div class="ov-head rise-in">
      <div>
        <h2 class="ov-title">我的业务</h2>
        <p class="ov-sub">{{ auth.user?.name }} · {{ rangeLabel }}数据</p>
      </div>
      <div class="segmented seg-sm" role="tablist" aria-label="时间范围">
        <button
          v-for="r in RANGES"
          :key="r.value"
          role="tab"
          :aria-selected="range === r.value"
          :class="{ active: range === r.value }"
          @click="range = r.value"
        >
          {{ r.label }}
        </button>
      </div>
    </div>

    <div class="grid-12">
      <StatCard
        class="span-3 rise-in"
        label="已核实成交"
        :value="num(data?.dealCount.value)"
        unit="笔"
        :delta="data?.dealCount.delta"
        :spark="trend.map((t) => t.dealCount)"
        :loading="first"
      />
      <StatCard
        class="span-3 rise-in"
        style="animation-delay: 40ms"
        label="成交额"
        :value="money(data?.dealAmount.value)"
        :delta="data?.dealAmount.delta"
        :spark="trend.map((t) => t.amount)"
        :loading="first"
      />
      <StatCard
        class="span-3 rise-in"
        style="animation-delay: 80ms"
        label="佣金"
        :value="money(data?.commission.value)"
        :delta="data?.commission.delta"
        :spark="trend.map((t) => t.commission)"
        :loading="first"
      />
      <StatCard
        class="span-3 rise-in"
        style="animation-delay: 120ms"
        label="待到账佣金"
        :value="money(data?.receivable.amount)"
        :note="data ? `${data.receivable.count} 笔 · 累计已到账 ${moneyShort(data.settledTotal)}` : undefined"
        :delta="null"
        :loading="first"
      />

      <TrendChart class="span-8 rise-in" style="animation-delay: 160ms" title="我的成交趋势" :data="trend" :loading="first" />

      <div class="card span-4 rise-in leads-card" style="animation-delay: 200ms">
        <div class="card-header">
          <div>
            <div class="card-title">我的客户线索</div>
            <div class="card-sub">
              共 <span class="num">{{ num(data?.leads.total) }}</span> 条 · {{ rangeLabel }}新增
              <span class="num">{{ num(data?.leads.newInRange) }}</span> 条
            </div>
          </div>
          <button class="link-btn" @click="router.push('/leads')">查看 <ArrowRight :size="14" /></button>
        </div>
        <div class="card-body">
          <template v-if="first">
            <NSkeleton v-for="i in 5" :key="i" text style="height: 22px; margin: 8px 0" />
          </template>
          <template v-else-if="data">
            <div class="sign-rate">
              <span class="text-3">签约率</span>
              <b class="num">{{ signRate === null ? '--' : `${signRate}%` }}</b>
            </div>
            <ul class="lead-rows">
              <li v-for="(r, i) in leadRows" :key="r.name">
                <div class="lead-row-top">
                  <span>{{ r.name }}</span>
                  <span class="num">{{ num(r.count) }}</span>
                </div>
                <div class="lead-bar" :class="{ signed: r.name === '已签约' }">
                  <i :style="{ width: `${r.pct}%`, animationDelay: `${i * 40}ms` }" />
                </div>
              </li>
            </ul>
            <button v-if="data.leads.needFollow" class="need-follow" @click="router.push('/leads')">
              <BellRing :size="14" :stroke-width="1.75" />
              有 <b class="num">{{ data.leads.needFollow }}</b> 条线索超过 7 天没跟进了
              <ArrowRight :size="13" class="nf-arrow" />
            </button>
          </template>
        </div>
      </div>

      <DealTable
        class="span-8 rise-in"
        style="animation-delay: 240ms"
        title="我最近录入的成交"
        :sub="data ? `待到账 ${data.receivable.count} 笔 · 佣金 ${money(data.receivable.amount)}` : undefined"
        :data="data?.recentDeals ?? []"
        :loading="first"
      />
      <TopOrgs
        class="span-4 rise-in"
        style="animation-delay: 280ms"
        :title="`${rangeLabel}合作最多的机构`"
        sub="按已核实成交的佣金排序"
        :show-range="false"
        :data="data?.topOrgs ?? []"
        :loading="first"
      />
    </div>
  </section>
</template>

<style scoped>
.staff-ov {
  margin-bottom: 24px;
}
.ov-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.ov-title {
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.01em;
}
.ov-sub {
  margin-top: 2px;
  font-size: 13px;
  color: var(--text-3);
}
.leads-card {
  display: flex;
  flex-direction: column;
}
.sign-rate {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 6px;
}
.sign-rate b {
  font-size: 22px;
  font-weight: 650;
  color: var(--success);
}
.lead-rows {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.lead-row-top {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-2);
  margin-bottom: 4px;
}
.lead-bar {
  height: 6px;
  border-radius: 3px;
  background: var(--neutral-soft);
  overflow: hidden;
}
.lead-bar i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--brand);
  transform-origin: left;
  animation: grow 0.6s ease both;
}
.lead-bar.signed i {
  background: var(--success);
}
@keyframes grow {
  from {
    transform: scaleX(0);
  }
}
.need-follow {
  margin-top: 14px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 0;
  border-radius: 8px;
  background: var(--warning-soft);
  color: var(--warning);
  font-size: 12.5px;
  cursor: pointer;
  text-align: left;
}
.need-follow b {
  font-weight: 650;
}
.nf-arrow {
  margin-left: auto;
}
</style>
