<script setup lang="ts">
import { computed } from 'vue';
import { NStatistic } from 'naive-ui';
import { Building2, DollarSign, FileCheck, Clock, TrendingUp, Wallet } from 'lucide-vue-next';
import type { OrgDetail } from '@bdcrm/shared';
import { money, num } from '@/utils/format';

const props = defineProps<{ org: OrgDetail }>();
defineEmits<{ refresh: [] }>();

const statsCards = computed(() => [
  { label: '总成交', value: num(props.org.stats.dealCount), suffix: '笔', icon: FileCheck, color: 'var(--brand)' },
  { label: '成交总额', value: money(props.org.stats.dealAmount), icon: DollarSign, color: 'var(--success)' },
  { label: '总佣金', value: money(props.org.stats.commission), icon: TrendingUp, color: 'var(--info)' },
  { label: '已结算', value: money(props.org.stats.settled), icon: Wallet, color: 'var(--success)' },
  { label: '未结算', value: money(props.org.stats.unsettled), icon: Clock, color: 'var(--warning)' },
  { label: '待审核', value: String(props.org.stats.pendingAudit), suffix: '笔', icon: Building2, color: 'var(--danger)' },
]);
</script>

<template>
  <div class="overview">
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div v-for="(s, i) in statsCards" :key="i" class="stat-card">
        <div class="stat-icon" :style="{ color: s.color, background: s.color + '14' }">
          <component :is="s.icon" :size="18" />
        </div>
        <div class="stat-body">
          <div class="stat-label text-3">{{ s.label }}</div>
          <div class="stat-value">{{ s.value }}<span v-if="s.suffix" class="stat-suffix">{{ s.suffix }}</span></div>
        </div>
      </div>
    </div>

    <!-- 基本信息快照 -->
    <div class="info-section">
      <h3 class="section-title">基本信息</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">机构名称</span>
          <span class="info-value">{{ org.name }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">所在地区</span>
          <span class="info-value">{{ org.province || '--' }} {{ org.city || '' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">默认佣金比例</span>
          <span class="info-value num">{{ org.defaultRate }}%</span>
        </div>
        <div class="info-item">
          <span class="info-label">业务类型</span>
          <span class="info-value">{{ org.businessTypes.join('、') || '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">覆盖国家</span>
          <span class="info-value">{{ org.countries.join('、') || '--' }}</span>
        </div>
        <div v-if="org.intro" class="info-item full">
          <span class="info-label">机构简介</span>
          <span class="info-value">{{ org.intro }}</span>
        </div>
      </div>
    </div>

    <!-- 联系人快照 -->
    <div v-if="org.contacts.length" class="info-section">
      <h3 class="section-title">主要联系人</h3>
      <div class="contacts-snap">
        <div v-for="c in org.contacts.slice(0, 3)" :key="c.id" class="contact-chip">
          <div class="contact-name">
            {{ c.name }}
            <span v-if="c.isPrimary" class="primary-badge">主要</span>
          </div>
          <div class="contact-meta text-3">
            {{ [c.title, c.phone].filter(Boolean).join(' · ') || '--' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
}
.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}
.stat-body {
  min-width: 0;
}
.stat-label {
  font-size: 12px;
  margin-bottom: 2px;
}
.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
.stat-suffix {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-3);
  margin-left: 2px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px 24px;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-item.full {
  grid-column: 1 / -1;
}
.info-label {
  font-size: 12px;
  color: var(--text-3);
}
.info-value {
  font-size: 14px;
  color: var(--text);
  line-height: 1.5;
}
.contacts-snap {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.contact-chip {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  min-width: 180px;
}
.contact-name {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.primary-badge {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 99px;
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 600;
}
.contact-meta {
  margin-top: 4px;
  font-size: 12px;
}
</style>
