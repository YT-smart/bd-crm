<script setup lang="ts">
import { onMounted, shallowRef, ref } from 'vue';
import { useRouter } from 'vue-router';
import { NButton, NProgress, NSkeleton, useMessage } from 'naive-ui';
import { ArrowRight, CircleAlert } from 'lucide-vue-next';
import type { MyOrgDashboard } from '@bdcrm/shared';
import { dashboardApi } from '@/api';
import { ApiError } from '@/api/http';
import StatusTag from '@/components/StatusTag.vue';
import { money, num } from '@/utils/format';
import StatCard from './components/StatCard.vue';
import DealTable from './components/DealTable.vue';

const router = useRouter();
const message = useMessage();
const data = shallowRef<MyOrgDashboard | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    data.value = await dashboardApi.my();
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="page">
    <section class="card org-head rise-in">
      <template v-if="loading">
        <NSkeleton text style="width: 40%; height: 24px" />
        <NSkeleton text style="width: 60%; margin-top: 12px" />
      </template>
      <template v-else-if="data">
        <div class="org-info">
          <div class="org-title">
            <h2>{{ data.org.name }}</h2>
            <StatusTag kind="org" :status="data.org.status" />
            <span v-if="data.org.level" class="pill pill-neutral plain">{{ data.org.level }} 级</span>
          </div>
          <p class="org-sub">
            默认佣金比例 <strong class="num">{{ data.org.defaultRate }}%</strong>
          </p>
        </div>
        <div class="org-complete">
          <div class="complete-row">
            <span>资料完整度</span>
            <strong class="num">{{ data.org.completeness }}%</strong>
          </div>
          <NProgress
            type="line"
            :percentage="data.org.completeness"
            :show-indicator="false"
            :height="6"
            rail-color="var(--neutral-soft)"
          />
          <div v-if="data.org.missing.length" class="missing">
            <CircleAlert :size="14" :stroke-width="1.75" />
            待补充：{{ data.org.missing.slice(0, 5).join('、') }}{{ data.org.missing.length > 5 ? ' 等' : '' }}
          </div>
        </div>
        <NButton id="go-my-org" type="primary" secondary @click="router.push('/my-org')">
          完善资料 <ArrowRight :size="14" style="margin-left: 4px" />
        </NButton>
      </template>
    </section>

    <section class="grid-12 cards">
      <StatCard class="span-3 rise-in" label="累计成交" :value="num(data?.totals.dealCount)" unit="笔" :note="`成交额 ${money(data?.totals.amount)}`" :delta="null" :loading="loading" />
      <StatCard class="span-3 rise-in" style="animation-delay: 40ms" label="应付佣金" :value="money(data?.totals.commission)" note="已核实成交的佣金合计" :delta="null" :loading="loading" />
      <StatCard class="span-3 rise-in" style="animation-delay: 80ms" label="已结算" :value="money(data?.totals.settled)" note="已确认到账" :delta="null" :loading="loading" />
      <StatCard class="span-3 rise-in" style="animation-delay: 120ms" label="未结算" :value="money(data?.totals.unsettled)" :note="`待审核 ${data?.totals.pendingAudit ?? 0} 笔 · 已驳回 ${data?.totals.rejected ?? 0} 笔`" :delta="null" :loading="loading" />

      <DealTable class="span-12 rise-in" style="animation-delay: 160ms" title="最近成交" sub="本机构最近录入的成交及审核状态" :data="data?.recentDeals ?? []" :loading="loading" :show-org="false" />
    </section>
  </div>
</template>

<style scoped>
.org-head {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 24px;
  flex-wrap: wrap;
}
.org-info {
  flex: 1;
  min-width: 240px;
}
.org-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.org-title h2 {
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.org-sub {
  margin-top: 6px;
  color: var(--text-3);
  font-size: 13px;
}
.org-sub strong {
  color: var(--text);
  font-weight: 600;
}
.org-complete {
  width: 320px;
}
.complete-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-2);
  margin-bottom: 8px;
}
.complete-row strong {
  color: var(--text);
}
.missing {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--warning);
}
.cards {
  margin-top: 16px;
}
</style>
