<script setup lang="ts">
import type { OrgStats } from '@bdcrm/shared';
import { money } from '@/utils/format';
import OrgCard from '../OrgCard.vue';

defineProps<{ stats: OrgStats }>();
</script>

<template>
  <OrgCard title="合作数据">
    <div class="kv-list">
      <div class="kv-row"><span class="kv-label">成交笔数</span><span class="kv-value num">{{ stats.dealCount }} 笔</span></div>
      <div class="kv-row"><span class="kv-label">成交总额</span><span class="kv-value num">{{ money(stats.dealAmount) }}</span></div>
      <div class="kv-row"><span class="kv-label">累计佣金</span><span class="kv-value num brand">{{ money(stats.commission) }}</span></div>
      <div class="kv-row"><span class="kv-label">已结算</span><span class="kv-value num success">{{ money(stats.settled) }}</span></div>
      <div class="kv-row"><span class="kv-label">待结算</span><span class="kv-value num warning">{{ money(stats.unsettled) }}</span></div>
      <div class="kv-row"><span class="kv-label">待审核</span><span class="kv-value num">{{ stats.pendingAudit }} 笔</span></div>
    </div>
  </OrgCard>
</template>

<style scoped>
.kv-label { flex-basis: 72px; }
.brand { color: var(--brand); font-weight: 600; }
.success { color: var(--success); font-weight: 600; }
.warning { color: var(--warning); font-weight: 600; }
</style>
