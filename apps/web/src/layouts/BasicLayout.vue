<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { onKeyStroke } from '@vueuse/core';
import { Moon, Search, Sun } from 'lucide-vue-next';
import { useAppStore } from '@/stores/app';
import AppSidebar from './AppSidebar.vue';
import CommandPalette from './CommandPalette.vue';

const route = useRoute();
const app = useAppStore();

const title = computed(() => (route.meta.title as string | undefined) ?? '');
const showSearch = ref(false);

onKeyStroke(
  (e) => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k',
  (e) => {
    e.preventDefault();
    showSearch.value = !showSearch.value;
  },
);

function toggleTheme() {
  app.setThemeMode(app.isDark ? 'light' : 'dark');
}
</script>

<template>
  <div class="shell">
    <AppSidebar />

    <div class="main">
      <header class="header">
        <h1 class="page-title">{{ title }}</h1>

        <button id="global-search-trigger" class="search-trigger" @click="showSearch = true">
          <Search :size="16" :stroke-width="1.75" />
          <span>搜索</span>
          <kbd>Ctrl K</kbd>
        </button>

        <div class="header-right">
          <!-- 页面级操作通过 Teleport 渲染到这里，例如仪表盘的时间范围切换 -->
          <div id="header-actions" class="header-actions" />
          <button
            id="theme-toggle"
            class="icon-btn"
            :aria-label="app.isDark ? '切换到浅色模式' : '切换到深色模式'"
            @click="toggleTheme"
          >
            <component :is="app.isDark ? Sun : Moon" :size="17" :stroke-width="1.75" />
          </button>
        </div>
      </header>

      <main class="content">
        <RouterView v-slot="{ Component, route: r }">
          <Transition name="fade-slide" mode="out-in">
            <component :is="Component" :key="r.path" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <CommandPalette v-model:show="showSearch" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100vh;
}
.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.header {
  position: sticky;
  top: 0;
  z-index: 5;
  display: grid;
  grid-template-columns: 1fr minmax(240px, 420px) 1fr;
  align-items: center;
  gap: 16px;
  height: var(--header-h);
  padding: 0 28px;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid transparent;
}
.page-title {
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
.search-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 8px 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text-3);
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.search-trigger:hover {
  border-color: var(--border-strong);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.search-trigger span {
  flex: 1;
  text-align: left;
}
.search-trigger kbd {
  height: 22px;
  padding: 0 6px;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--text-3);
  background: var(--bg-subtle);
}
.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text-2);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.icon-btn:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
.content {
  flex: 1;
  min-width: 0;
}

@media (max-width: 900px) {
  .header {
    grid-template-columns: 1fr auto;
  }
  .search-trigger {
    display: none;
  }
}
</style>
