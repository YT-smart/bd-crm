import { defineStore } from 'pinia';
import { computed, watch } from 'vue';
import { usePreferredDark, useStorage } from '@vueuse/core';

export type ThemeMode = 'light' | 'dark' | 'system';

export const useAppStore = defineStore('app', () => {
  const themeMode = useStorage<ThemeMode>('bdcrm:theme', 'system');
  const sidebarCollapsed = useStorage('bdcrm:sidebar-collapsed', false);
  const prefersDark = usePreferredDark();

  const isDark = computed(() => themeMode.value === 'dark' || (themeMode.value === 'system' && prefersDark.value));

  watch(
    isDark,
    (v) => {
      document.documentElement.classList.toggle('dark', v);
    },
    { immediate: true },
  );

  function setThemeMode(mode: ThemeMode) {
    themeMode.value = mode;
  }

  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  return { themeMode, isDark, sidebarCollapsed, setThemeMode, toggleSidebar };
});
