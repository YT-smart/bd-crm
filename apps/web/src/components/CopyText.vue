<script setup lang="ts">
import { ref } from 'vue';
import { useMessage } from 'naive-ui';
import { Check, Copy } from 'lucide-vue-next';
import { copyText } from '@/utils/clipboard';

/** 点击即可复制的文本；值为空时显示占位符且不可点击 */
const props = withDefaults(defineProps<{ value?: string | null; label?: string; placeholder?: string }>(), {
  placeholder: '--',
});
const message = useMessage();
const done = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

async function copy() {
  if (!props.value) return;
  const ok = await copyText(props.value);
  if (!ok) {
    message.warning('复制失败，请手动选择文本');
    return;
  }
  message.success(`已复制${props.label ? props.label : ''}`);
  done.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => (done.value = false), 1500);
}
</script>

<template>
  <span v-if="value" class="copy-text" role="button" tabindex="0" :title="`点击复制${label ?? ''}`" @click="copy" @keydown.enter="copy">
    <span class="copy-val"><slot>{{ value }}</slot></span>
    <component :is="done ? Check : Copy" :size="13" :stroke-width="1.9" :class="['copy-ic', { done }]" />
  </span>
  <span v-else>{{ placeholder }}</span>
</template>

<style scoped>
.copy-text {
  display: inline;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s, color 0.15s;
}
.copy-text:hover,
.copy-text:focus-visible {
  color: var(--brand);
  background: var(--brand-soft);
  outline: none;
}
.copy-val {
  white-space: inherit;
}
.copy-ic {
  display: inline-block;
  vertical-align: -2px;
  margin-left: 4px;
  color: var(--text-3);
  opacity: 0;
  transition: opacity 0.15s;
}
.copy-text:hover .copy-ic,
.copy-text:focus-visible .copy-ic,
.copy-ic.done {
  opacity: 1;
  color: var(--brand);
}
@media (hover: none) {
  .copy-ic {
    opacity: 0.6;
  }
}
</style>
