<script setup lang="ts">
import { computed } from 'vue';
import {
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NLoadingBarProvider,
  NMessageProvider,
  darkTheme,
  dateZhCN,
  zhCN,
} from 'naive-ui';
import { useAppStore } from '@/stores/app';
import { getThemeOverrides } from '@/theme/naive';

const app = useAppStore();
const theme = computed(() => (app.isDark ? darkTheme : null));
const overrides = computed(() => getThemeOverrides(app.isDark));
</script>

<template>
  <NConfigProvider :theme="theme" :theme-overrides="overrides" :locale="zhCN" :date-locale="dateZhCN">
    <NGlobalStyle />
    <NLoadingBarProvider>
      <NDialogProvider>
        <NMessageProvider placement="top" :duration="2600">
          <RouterView />
        </NMessageProvider>
      </NDialogProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
