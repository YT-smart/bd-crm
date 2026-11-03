<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 28 });
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 32 32" aria-hidden="true" class="logo-mark">
    <rect width="32" height="32" rx="8" fill="var(--brand)" />
    <path
      d="M9 21.5c3.2-1 5.8-3.6 7-7 1.2 3.4 3.8 6 7 7"
      fill="none"
      stroke="#fff"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle cx="16" cy="10.5" r="2.2" fill="#fff" />
  </svg>
</template>

<style scoped>
.logo-mark {
  flex-shrink: 0;
  display: block;
}
</style>
