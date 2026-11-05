<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <section class="card org-card">
    <header class="org-card-head">
      <h2 class="org-card-title">{{ title }}</h2>
      <div class="org-card-extra"><slot name="extra" /></div>
    </header>
    <div class="org-card-body"><slot /></div>
  </section>
</template>

<style scoped>
.org-card {
  padding: 20px 24px 22px;
  min-width: 0;
}
.org-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
  margin-bottom: 14px;
}
.org-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}
.org-card-extra {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
