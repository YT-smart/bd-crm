<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DealSource, OrgStats } from '@bdcrm/shared';
import { dealApi } from '@/api';
import { money } from '@/utils/format';
import OrgCard from '../OrgCard.vue';

/** source：管理员在成交记录里选了「员工录入 / 机构录入」时，合作数据也只统计这一方 */
const props = defineProps<{ stats: OrgStats; orgId: string; source?: DealSource | null }>();

const filtered = ref<OrgStats | null>(null);
watch(
  () => [props.source, props.orgId, props.stats] as const,
  async ([src, orgId]) => {
    if (!src) { filtered.value = null; return; }
    try {
      const s = await dealApi.summary({ orgId, creatorType: src });
      if (props.source !== src) return; // 期间又切换了
      filtered.value = {
        dealCount: s.count,
        dealAmount: s.amount,
        commission: s.commission,
        settled: s.settledAmount,
        unsettled: s.pendingAmount,
      };
    } catch {
      filtered.value = null;
    }
  },
  { immediate: true },
);
const view = computed(() => (props.source && filtered.value) || props.stats);
const title = computed(() =>
  props.source === 'STAFF' ? '合作数据（员工录入）' : props.source === 'ORG' ? '合作数据（机构录入）' : '合作数据',
);
</script>

<template>
  <OrgCard :title="title">
    <div class="kv-list">
      <div class="kv-row"><span class="kv-label">成交笔数</span><span class="kv-value num">{{ view.dealCount }} 笔</span></div>
      <div class="kv-row"><span class="kv-label">成交总额</span><span class="kv-value num">{{ money(view.dealAmount) }}</span></div>
      <div class="kv-row"><span class="kv-label">累计佣金</span><span class="kv-value num brand">{{ money(view.commission) }}</span></div>
      <div class="kv-row"><span class="kv-label">已结算</span><span class="kv-value num success">{{ money(view.settled) }}</span></div>
      <div class="kv-row"><span class="kv-label">待结算</span><span class="kv-value num warning">{{ money(view.unsettled) }}</span></div>
    </div>
  </OrgCard>
</template>

<style scoped>
.kv-label { flex-basis: 72px; }
.brand { color: var(--brand); font-weight: 600; }
.success { color: var(--success); font-weight: 600; }
.warning { color: var(--warning); font-weight: 600; }
</style>
