/**
 * ECharts 按需引入，只注册用到的图表与组件，减小包体积。
 */
import * as echarts from 'echarts/core';
import { BarChart, LineChart, MapChart, PieChart } from 'echarts/charts';
import {
  GeoComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

echarts.use([
  BarChart,
  LineChart,
  MapChart,
  PieChart,
  GeoComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export { echarts };
export type { EChartsOption };

let chinaMapTask: Promise<void> | null = null;

/** 加载并注册中国地图（DataV 省级 GeoJSON，放在 public/geo/china.json） */
export function ensureChinaMap(): Promise<void> {
  if (!chinaMapTask) {
    chinaMapTask = fetch('/geo/china.json')
      .then((r) => {
        if (!r.ok) throw new Error('地图数据加载失败');
        return r.json();
      })
      .then((geo) => {
        echarts.registerMap('china', geo);
      })
      .catch((e) => {
        chinaMapTask = null;
        throw e;
      });
  }
  return chinaMapTask;
}
