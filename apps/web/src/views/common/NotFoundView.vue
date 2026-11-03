<script setup lang="ts">
import { useRouter } from 'vue-router';
import { NButton } from 'naive-ui';
import { Compass } from 'lucide-vue-next';

const router = useRouter();
</script>

<template>
  <div class="page">
    <div class="card state rise-in">
      <div class="state-icon"><Compass :size="22" :stroke-width="1.75" /></div>
      <h2 class="state-title">页面不存在</h2>
      <p class="state-desc">你访问的地址不存在或已被移除。</p>
      <NButton id="notfound-back" secondary @click="router.push('/dashboard')">返回仪表盘</NButton>
    </div>
  </div>
</template>

<style scoped>
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 72px 24px;
}
.state-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--neutral-soft);
  color: var(--text-2);
}
.state-title {
  margin-top: 16px;
  font-size: 18px;
  font-weight: 600;
}
.state-desc {
  margin: 8px 0 24px;
  color: var(--text-2);
}
</style>
