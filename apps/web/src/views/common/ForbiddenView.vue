<script setup lang="ts">
import { useRouter } from 'vue-router';
import { NButton } from 'naive-ui';
import { ShieldOff } from 'lucide-vue-next';

const router = useRouter();
</script>

<template>
  <div class="page">
    <div class="card state rise-in">
      <div class="state-icon"><ShieldOff :size="22" :stroke-width="1.75" /></div>
      <h2 class="state-title">没有访问权限</h2>
      <p class="state-desc">当前账号无权访问该页面，如需开通请联系管理员。</p>
      <NButton id="forbidden-back" secondary @click="router.push('/dashboard')">返回仪表盘</NButton>
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
  background: var(--warning-soft);
  color: var(--warning);
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
