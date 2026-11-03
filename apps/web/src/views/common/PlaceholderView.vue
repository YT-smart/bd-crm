<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { NButton } from 'naive-ui';
import { Layers } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
</script>

<template>
  <div class="page">
    <div class="card state rise-in">
      <div class="state-icon"><Layers :size="22" :stroke-width="1.75" /></div>
      <h2 class="state-title">{{ route.meta.title }}</h2>
      <p class="state-desc">
        该模块计划在 <strong>{{ route.meta.phase }}</strong> 开发，当前为占位页面。菜单与权限控制已生效。
      </p>
      <NButton id="placeholder-back" secondary @click="router.push('/dashboard')">返回仪表盘</NButton>
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
  background: var(--brand-soft);
  color: var(--brand);
}
.state-title {
  margin-top: 16px;
  font-size: 18px;
  font-weight: 600;
}
.state-desc {
  margin: 8px 0 24px;
  color: var(--text-2);
  max-width: 420px;
}
.state-desc strong {
  color: var(--text);
  font-weight: 600;
}
</style>
