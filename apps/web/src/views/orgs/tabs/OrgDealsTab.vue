<script setup lang="ts">
import { NEmpty } from 'naive-ui';
import type { OrgStats } from '@bdcrm/shared';
import { money } from '@/utils/format';

const props = defineProps<{ orgId: string; stats: OrgStats }>();
</script>

<template>
  <div>
    <div class="stats-row">
      <div class="mini-stat">
        <div class="mini-label text-3">总成交</div>
        <div class="mini-value">{{ stats.dealCount }} <span class="text-3">笔</span></div>
      </div>
      <div class="mini-stat">
        <div class="mini-label text-3">成交总额</div>
        <div class="mini-value">{{ money(stats.dealAmount) }}</div>
      </div>
      <div class="mini-stat">
        <div class="mini-label text-3">已结算</div>
        <div class="mini-value success">{{ money(stats.settled) }}</div>
      </div>
      <div class="mini-stat">
        <div class="mini-label text-3">未结算</div>
        <div class="mini-value warning">{{ money(stats.unsettled) }}</div>
      </div>
    </div>

    <NEmpty v-if="!stats.dealCount" description="暂无成交记录" style="margin-top: 40px" />
    <div v-else class="placeholder-hint text-3">
      成交列表将在阶段 3（成交与结算模块）中完整实现。当前可在侧边栏"成交与结算"页面查看全部记录。
    </div>
  </div>
</template>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}
.mini-stat {
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.mini-label {
  font-size: 12px;
  margin-bottom: 4px;
}
.mini-value {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}
.mini-value.success { color: var(--success); }
.mini-value.warning { color: var(--warning); }
.placeholder-hint {
  padding: 40px;
  text-align: center;
  font-size: 13px;
}
</style>
