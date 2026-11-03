<script setup lang="ts">
import { computed } from 'vue';
import { NSkeleton } from 'naive-ui';
import type { TopOrgItem } from '@bdcrm/shared';
import { money, moneyShort, num } from '@/utils/format';

const props = defineProps<{ data: TopOrgItem[]; rangeLabel: string; loading?: boolean }>();

const max = computed(() => Math.max(1, ...props.data.map((d) => d.commission)));
</script>

<template>
  <div class="card">
    <div class="card-header">
      <div>
        <div class="card-title">机构佣金贡献 Top 10</div>
        <div class="card-sub">{{ rangeLabel }} · 按已核实成交的佣金排序</div>
      </div>
    </div>
    <div class="card-body">
      <template v-if="loading">
        <NSkeleton v-for="i in 8" :key="i" text style="height: 22px; margin: 8px 0" />
      </template>
      <div v-else-if="!data.length" class="empty">该时间范围内暂无成交</div>
      <ol v-else class="top-list">
        <li v-for="(o, i) in data" :key="o.id" class="top-item" :title="`${o.name}\n成交 ${num(o.dealCount)} 笔 · 成交额 ${money(o.amount)}`">
          <span class="top-no num" :class="{ top: i < 3 }">{{ i + 1 }}</span>
          <div class="top-main">
            <div class="top-row">
              <span class="top-name ellipsis">{{ o.name }}</span>
              <span class="top-val num">{{ moneyShort(o.commission) }}</span>
            </div>
            <div class="top-bar"><i :style="{ width: `${(o.commission / max) * 100}%`, animationDelay: `${i * 40}ms` }" /></div>
          </div>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.top-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.top-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
.top-no {
  width: 20px;
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
  flex-shrink: 0;
}
.top-no.top {
  color: var(--brand);
  font-weight: 600;
}
.top-main {
  flex: 1;
  min-width: 0;
}
.top-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}
.top-name {
  color: var(--text);
}
.top-val {
  color: var(--text-2);
  flex-shrink: 0;
}
.top-bar {
  margin-top: 5px;
  height: 5px;
  border-radius: 3px;
  background: var(--neutral-soft);
  overflow: hidden;
}
.top-bar i {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--brand);
  transform-origin: left;
  animation: grow 0.7s var(--ease) both;
}
@keyframes grow {
  from {
    transform: scaleX(0);
  }
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
</style>
