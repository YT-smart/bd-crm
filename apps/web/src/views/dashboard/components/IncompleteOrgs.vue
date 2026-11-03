<script setup lang="ts">
import { useRouter } from 'vue-router';
import { NProgress, NSkeleton } from 'naive-ui';
import type { OrgBrief } from '@bdcrm/shared';
import StatusTag from '@/components/StatusTag.vue';

defineProps<{ data: OrgBrief[]; loading?: boolean }>();
const router = useRouter();

function tone(v: number) {
  if (v < 40) return 'var(--danger)';
  if (v < 60) return 'var(--warning)';
  return 'var(--brand)';
}
</script>

<template>
  <div class="card">
    <div class="card-header">
      <div>
        <div class="card-title">资料待完善机构</div>
        <div class="card-sub">资料完整度低于 70% 的洽谈中 / 合作中机构</div>
      </div>
    </div>
    <div class="card-body">
      <template v-if="loading">
        <NSkeleton v-for="i in 6" :key="i" text style="height: 34px; margin: 6px 0" />
      </template>
      <div v-else-if="!data.length" class="empty">所有机构资料均已完善</div>
      <ul v-else class="list">
        <li v-for="o in data" :key="o.id">
          <button :id="`incomplete-${o.id}`" class="item" @click="router.push({ path: '/orgs', query: { keyword: o.name } })">
            <div class="item-top">
              <span class="item-name ellipsis">{{ o.name }}</span>
              <StatusTag kind="org" :status="o.status" />
            </div>
            <div class="item-bottom">
              <NProgress
                type="line"
                :percentage="o.completeness"
                :show-indicator="false"
                :height="5"
                :color="tone(o.completeness)"
                rail-color="var(--neutral-soft)"
              />
              <span class="item-pct num">{{ o.completeness }}%</span>
            </div>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  margin: 0 -10px;
  width: calc(100% + 20px);
  border: 0;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  color: var(--text);
  transition: background-color 0.15s;
}
.item:hover {
  background: var(--neutral-soft);
}
.item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}
.item-name {
  min-width: 0;
}
.item-bottom {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}
.item-bottom :deep(.n-progress) {
  flex: 1;
  min-width: 0;
}
.item-pct {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-3);
  width: 34px;
  text-align: right;
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
</style>
