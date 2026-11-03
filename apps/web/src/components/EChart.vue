<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import type { ECharts } from 'echarts/core';
import { echarts, type EChartsOption } from '@/plugins/echarts';

const props = defineProps<{
  option: EChartsOption;
  height?: string;
}>();

const emit = defineEmits<{
  (e: 'chart-click', params: unknown): void;
  (e: 'ready', chart: ECharts): void;
}>();

const el = ref<HTMLDivElement>();
const chart = shallowRef<ECharts>();
let ro: ResizeObserver | null = null;
let raf = 0;

onMounted(() => {
  if (!el.value) return;
  chart.value = echarts.init(el.value, undefined, { renderer: 'canvas' });
  chart.value.setOption(props.option);
  chart.value.on('click', (p) => emit('chart-click', p));
  emit('ready', chart.value);

  ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => chart.value?.resize());
  });
  ro.observe(el.value);
});

watch(
  () => props.option,
  (opt) => chart.value?.setOption(opt, { notMerge: true }),
);

onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  ro?.disconnect();
  chart.value?.dispose();
});

defineExpose({ chart });
</script>

<template>
  <div ref="el" class="echart" :style="{ height: height ?? '100%' }" />
</template>

<style scoped>
.echart {
  width: 100%;
  min-height: 0;
}
</style>
