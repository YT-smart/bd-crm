import { computed } from 'vue';
import { useAppStore } from '@/stores/app';

/** 图表配色，随浅色 / 深色模式切换 */
export function useChartTheme() {
  const app = useAppStore();
  return computed(() => {
    const dark = app.isDark;
    return {
      dark,
      text: dark ? '#E8EAF0' : '#0F172A',
      text2: dark ? '#A3ABBD' : '#475467',
      text3: dark ? '#6B7385' : '#8A94A6',
      axisLine: dark ? '#2F3443' : '#E6E8EC',
      splitLine: dark ? 'rgba(255,255,255,0.06)' : '#F0F2F5',
      surface: dark ? '#13161D' : '#FFFFFF',
      brand: dark ? '#5C7CFA' : '#3B5BDB',
      brandSoft: dark ? 'rgba(92,124,250,0.16)' : 'rgba(59,91,219,0.10)',
      ink: dark ? '#C5CEFF' : '#1E2A5A',
      accent: dark ? '#FFA94D' : '#F08C00',
      tooltipBg: dark ? '#191D26' : '#FFFFFF',
      tooltipBorder: dark ? '#2F3443' : '#E6E8EC',
      mapEmpty: dark ? '#1A1E28' : '#F1F3F6',
      mapBorder: dark ? '#0B0D12' : '#FFFFFF',
      mapRange: dark
        ? ['#1F2A55', '#2C3E8C', '#3B5BDB', '#5C7CFA', '#91A7FF']
        : ['#DBE4FF', '#BAC8FF', '#748FFC', '#4C6EF5', '#2B3F9E'],
      series: dark
        ? ['#5C7CFA', '#4DABF7', '#38D9A9', '#FFA94D', '#DA77F2', '#ADB5BD']
        : ['#3B5BDB', '#1C7ED6', '#0CA678', '#F08C00', '#AE3EC9', '#868E96'],
    };
  });
}

export type ChartTheme = ReturnType<typeof useChartTheme>['value'];

/** tooltip 的通用外观 */
export function tooltipBase(t: ChartTheme) {
  return {
    backgroundColor: t.tooltipBg,
    borderColor: t.tooltipBorder,
    borderWidth: 1,
    padding: [10, 12] as [number, number],
    textStyle: { color: t.text, fontSize: 12 },
    extraCssText: `border-radius:8px;box-shadow:0 8px 24px -6px rgba(15,23,42,${t.dark ? 0.6 : 0.16});`,
  };
}
