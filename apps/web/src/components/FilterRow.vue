<script setup lang="ts">
/**
 * 筛选面板的一行：「不限」+ 选项按钮，可多选（single 时只能选一个）；点「不限」清空。
 * 默认插槽放在按钮后面，比如「更多城市」下拉。
 */
export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

const props = defineProps<{ label: string; options: readonly FilterOption[]; single?: boolean }>();
const model = defineModel<string[]>({ required: true });

function toggle(v: string) {
  if (model.value.includes(v)) model.value = model.value.filter((x) => x !== v);
  else model.value = props.single ? [v] : [...model.value, v];
}
</script>

<template>
  <div class="frow">
    <div class="frow-label">{{ props.label }}：</div>
    <div class="frow-opts">
      <button type="button" :class="['fopt', { on: !model.length }]" @click="model = []">不限</button>
      <button
        v-for="o in props.options"
        :key="o.value"
        type="button"
        :class="['fopt', { on: model.includes(o.value) }]"
        @click="toggle(o.value)"
      >
        {{ o.label }}<span v-if="o.count != null" class="fcount num">{{ o.count }}</span>
      </button>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.frow {
  display: flex;
  gap: 8px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}
.frow:last-child {
  border-bottom: 0;
}
.frow-label {
  flex: 0 0 76px;
  padding-top: 5px;
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
}
.frow-opts {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.fopt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 12.5px;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.12s, color 0.12s;
}
.fopt:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.fopt.on {
  border-color: var(--brand);
  color: var(--brand);
  background: var(--brand-soft);
}
.fcount {
  font-size: 11px;
  color: var(--text-3);
}
.fopt.on .fcount {
  color: var(--brand);
}
@media (max-width: 640px) {
  .frow {
    flex-direction: column;
    gap: 6px;
  }
  .frow-label {
    flex: none;
    padding-top: 0;
  }
}
</style>
