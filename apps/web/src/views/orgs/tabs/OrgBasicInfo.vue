<script setup lang="ts">
import { NProgress } from 'naive-ui';
import { Pencil } from 'lucide-vue-next';
import StatusTag from '@/components/StatusTag.vue';
import CopyText from '@/components/CopyText.vue';
import type { OrgDetail } from '@bdcrm/shared';
import { date } from '@/utils/format';
import OrgCard from '../OrgCard.vue';

withDefaults(defineProps<{ org: OrgDetail; canEdit?: boolean; internal?: boolean }>(), {
  canEdit: true,
  internal: true,
});
const emit = defineEmits<{ edit: [] }>();
</script>

<template>
  <OrgCard title="基本信息">
    <template v-if="canEdit" #extra>
      <button class="btn-outline-sm" @click="emit('edit')"><Pencil :size="13" :stroke-width="1.75" /> 编辑</button>
    </template>

    <div class="kv-list">
      <div class="kv-row">
        <span class="kv-label">机构名称</span>
        <span class="kv-value name-cell">
          <span class="org-name"><CopyText :value="org.name" label="机构名称" /></span>
          <StatusTag v-if="internal" kind="org" :status="org.status" />
          <span v-if="internal && org.level" :class="['level', `level-${org.level}`]">{{ org.level }} 级</span>
        </span>
      </div>
      <div class="kv-row">
        <span class="kv-label">总部城市</span>
        <span class="kv-value"><CopyText :value="org.city" label="总部城市" /></span>
      </div>
      <div class="kv-row">
        <span class="kv-label">办公城市</span>
        <span class="kv-value"><CopyText :value="org.officeCities.join('、')" label="办公城市" /></span>
      </div>
      <div class="kv-row">
        <span class="kv-label">覆盖国家/地区</span>
        <span class="kv-value">
          <template v-if="org.countries.length">
            <span v-for="c in org.countries" :key="c" class="kv-chip">{{ c }}</span>
          </template>
          <template v-else>--</template>
        </span>
      </div>
      <div class="kv-row">
        <span class="kv-label">业务类型</span>
        <span class="kv-value">{{ org.businessTypes.join('、') || '--' }}</span>
      </div>
      <div class="kv-row">
        <span class="kv-label">默认佣金</span>
        <span class="kv-value num">{{ org.defaultRate }}%</span>
      </div>
      <div v-if="internal" class="kv-row">
        <span class="kv-label">标签</span>
        <span class="kv-value">
          <template v-if="org.tags.length">
            <span v-for="t in org.tags" :key="t" class="kv-chip brand">{{ t }}</span>
          </template>
          <template v-else>--</template>
        </span>
      </div>
      <div class="kv-row">
        <span class="kv-label">机构规模</span>
        <span class="kv-value">{{ org.scale || '--' }}</span>
      </div>
      <div class="kv-row">
        <span class="kv-label">机构简介</span>
        <span class="kv-value pre"><CopyText :value="org.intro" label="机构简介" /></span>
      </div>
      <div class="kv-row">
        <span class="kv-label">机构优势</span>
        <span class="kv-value"><CopyText :value="org.advantage" label="机构优势" /></span>
      </div>
      <div v-if="internal" class="kv-row">
        <span class="kv-label">负责人</span>
        <span class="kv-value"><CopyText :value="org.ownerName" label="负责人" /></span>
      </div>
      <div class="kv-row">
        <span class="kv-label">录入时间</span>
        <span class="kv-value num">{{ date(org.createdAt) }}</span>
      </div>
      <div class="kv-row">
        <span class="kv-label">资料完整度</span>
        <span class="kv-value completeness">
          <NProgress
            type="line"
            :percentage="org.completeness"
            :show-indicator="false"
            :height="6"
            rail-color="var(--neutral-soft)"
            :color="org.completeness < 40 ? 'var(--danger)' : org.completeness < 70 ? 'var(--warning)' : 'var(--brand)'"
            style="width: 180px"
          />
          <span class="num">{{ org.completeness }}%</span>
          <span v-if="org.missing.length" class="missing">待完善：{{ org.missing.join('、') }}</span>
        </span>
      </div>
    </div>
  </OrgCard>
</template>

<style scoped>
.name-cell {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.org-name {
  font-weight: 600;
}
.level {
  font-size: 12px;
  line-height: 20px;
  padding: 0 8px;
  border-radius: 6px;
  font-weight: 600;
}
.level-A { background: var(--brand-soft); color: var(--brand); }
.level-B { background: var(--info-soft); color: var(--info); }
.level-C { background: var(--neutral-soft); color: var(--text-2); }
.completeness {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.missing {
  font-size: 13px;
  color: var(--warning);
}
</style>
