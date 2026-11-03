<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 32 });

const PALETTE = ['#3B5BDB', '#1C7ED6', '#0CA678', '#F08C00', '#AE3EC9', '#E64980', '#1098AD', '#7048E8'];

const initials = computed(() => {
  const n = props.name.trim();
  if (!n) return '?';
  // 中文名取后两个字，英文取首字母
  return /[\u4e00-\u9fa5]/.test(n) ? n.slice(-2) : n.slice(0, 2).toUpperCase();
});

const color = computed(() => {
  let h = 0;
  for (const ch of props.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
});
</script>

<template>
  <span
    class="avatar"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.36)}px`, background: color }"
  >
    {{ initials }}
  </span>
</template>

<style scoped>
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  color: #fff;
  font-weight: 600;
  letter-spacing: 0.02em;
  user-select: none;
}
</style>
