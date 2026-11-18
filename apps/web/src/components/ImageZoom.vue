<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Maximize, Minus, Plus, RotateCw } from 'lucide-vue-next';

/**
 * 图片查看：滚轮 / 按钮缩放（以鼠标位置为中心），拖动平移，双击在「适应窗口」和「100%」之间切换，
 * 触屏支持双指缩放和单指拖动。placeholder 为缩略图，原图加载完成前先显示它。
 */
const props = defineProps<{ src: string; placeholder?: string; alt?: string }>();

const MIN = 0.1;
const MAX = 8;

const box = ref<HTMLDivElement | null>(null);
const natural = ref({ w: 0, h: 0 });
const scale = ref(1);
const fitScale = ref(1);
const rotate = ref(0);
const tx = ref(0);
const ty = ref(0);
const dragging = ref(false);
const loaded = ref(false);

const percent = computed(() => Math.round(scale.value * 100));
const style = computed(() => ({
  width: `${natural.value.w}px`,
  height: `${natural.value.h}px`,
  transform: `translate(${tx.value}px, ${ty.value}px) scale(${scale.value}) rotate(${rotate.value}deg)`,
  transition: dragging.value ? 'none' : 'transform 0.12s ease-out',
}));

watch(
  () => props.src,
  () => {
    loaded.value = false;
    rotate.value = 0;
  },
);

function onLoad(e: Event) {
  const img = e.target as HTMLImageElement;
  natural.value = { w: img.naturalWidth, h: img.naturalHeight };
  loaded.value = true;
  initialView();
}

/** 打开时：普通图片完整显示；特别长的图（长截图、海报）按宽度铺满并从顶部开始看，不然字太小 */
function initialView() {
  fit();
  const el = box.value;
  if (!el) return;
  const shownWidth = natural.value.w * scale.value;
  if (shownWidth < el.clientWidth * 0.45) {
    const s = Math.min((el.clientWidth - 32) / natural.value.w, 1);
    scale.value = s;
    tx.value = (el.clientWidth - natural.value.w) / 2;
    // transform-origin 在中心：让图片顶部距容器顶部 16px
    ty.value = 16 - (natural.value.h * (1 - s)) / 2;
  }
}

/** 适应窗口：整张图完整显示，小图不放大 */
function fit() {
  const el = box.value;
  if (!el || !natural.value.w) return;
  const sideways = rotate.value % 180 !== 0;
  const w = sideways ? natural.value.h : natural.value.w;
  const h = sideways ? natural.value.w : natural.value.h;
  const s = Math.min((el.clientWidth - 32) / w, (el.clientHeight - 32) / h, 1);
  fitScale.value = s;
  scale.value = s;
  center();
}

function center() {
  const el = box.value;
  if (!el) return;
  tx.value = (el.clientWidth - natural.value.w) / 2;
  ty.value = (el.clientHeight - natural.value.h) / 2;
}

/** 以 (cx, cy)（相对容器）为中心缩放到 next */
function zoomTo(next: number, cx?: number, cy?: number) {
  const el = box.value;
  if (!el) return;
  next = Math.min(MAX, Math.max(MIN, next));
  const px = cx ?? el.clientWidth / 2;
  const py = cy ?? el.clientHeight / 2;
  // 图片中心点在容器中的位置（transform-origin 为中心）
  const ox = tx.value + natural.value.w / 2;
  const oy = ty.value + natural.value.h / 2;
  const k = next / scale.value;
  tx.value += (px - ox) * (1 - k);
  ty.value += (py - oy) * (1 - k);
  scale.value = next;
}

const zoomIn = () => zoomTo(scale.value * 1.25);
const zoomOut = () => zoomTo(scale.value / 1.25);
const actual = () => zoomTo(1);
function rotateRight() {
  rotate.value = (rotate.value + 90) % 360;
  fit();
}

function onWheel(e: WheelEvent) {
  const rect = box.value!.getBoundingClientRect();
  // 触控板双指捏合会带 ctrlKey，幅度更小
  const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
  zoomTo(scale.value * factor, e.clientX - rect.left, e.clientY - rect.top);
}

function onDblClick(e: MouseEvent) {
  const rect = box.value!.getBoundingClientRect();
  if (Math.abs(scale.value - fitScale.value) < 0.01) zoomTo(Math.max(1, fitScale.value * 2), e.clientX - rect.left, e.clientY - rect.top);
  else fit();
}

/* ---------- 拖动 / 触屏手势（Pointer Events） ---------- */
const pointers = new Map<number, { x: number; y: number }>();
let last: { x: number; y: number } | null = null;
let pinchDist = 0;

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragging.value = true;
  last = { x: e.clientX, y: e.clientY };
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchDist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
  }
}

function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    const rect = box.value!.getBoundingClientRect();
    if (pinchDist) zoomTo(scale.value * (d / pinchDist), (a!.x + b!.x) / 2 - rect.left, (a!.y + b!.y) / 2 - rect.top);
    pinchDist = d;
    return;
  }
  if (last) {
    tx.value += e.clientX - last.x;
    ty.value += e.clientY - last.y;
  }
  last = { x: e.clientX, y: e.clientY };
}

function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId);
  pinchDist = 0;
  const rest = [...pointers.values()][0];
  last = rest ? { ...rest } : null;
  if (!pointers.size) dragging.value = false;
}

/* ---------- 键盘：+ / - / 0 ---------- */
function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === '+' || e.key === '=') zoomIn();
  else if (e.key === '-') zoomOut();
  else if (e.key === '0') fit();
}
window.addEventListener('keydown', onKey);

let ro: ResizeObserver | null = null;
watch(box, (el) => {
  ro?.disconnect();
  if (el) {
    ro = new ResizeObserver(() => loaded.value && fit());
    ro.observe(el);
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  ro?.disconnect();
});
</script>

<template>
  <div
    ref="box"
    :class="['iz', { grabbing: dragging }]"
    @wheel.prevent="onWheel"
    @dblclick="onDblClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <!-- 原图下载完之前先显示缩略图 -->
    <img v-if="placeholder && !loaded" class="iz-ph" :src="placeholder" :alt="alt" draggable="false" />
    <img v-if="src" v-show="loaded" class="iz-img" :src="src" :alt="alt" :style="style" draggable="false" @load="onLoad" />

    <div v-if="loaded" class="iz-bar" @pointerdown.stop @dblclick.stop>
      <button title="缩小（-）" @click="zoomOut"><Minus :size="16" /></button>
      <button class="pct" title="原始大小" @click="actual">{{ percent }}%</button>
      <button title="放大（+）" @click="zoomIn"><Plus :size="16" /></button>
      <span class="sep" />
      <button title="适应窗口（0）" @click="fit"><Maximize :size="15" /></button>
      <button title="旋转" @click="rotateRight"><RotateCw :size="15" /></button>
    </div>
    <div v-if="loaded" class="iz-tip">滚轮缩放 · 拖动查看 · 双击放大</div>
  </div>
</template>

<style scoped>
.iz {
  position: absolute;
  inset: 0;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.iz.grabbing { cursor: grabbing; }
.iz-img {
  position: absolute;
  left: 0;
  top: 0;
  max-width: none;
  transform-origin: center center;
  will-change: transform;
}
.iz-ph {
  position: absolute;
  inset: 16px;
  width: calc(100% - 32px);
  height: calc(100% - 32px);
  object-fit: contain;
  filter: blur(2px);
  opacity: 0.85;
}
.iz-bar {
  position: absolute;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.78);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.25);
  cursor: default;
}
.iz-bar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 30px;
  padding: 0 6px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #fff;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.iz-bar button:hover { background: rgba(255, 255, 255, 0.16); }
.iz-bar .pct { min-width: 54px; }
.iz-bar .sep { width: 1px; height: 18px; margin: 0 4px; background: rgba(255, 255, 255, 0.25); }
.iz-tip {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.5);
  color: #fff;
  font-size: 12px;
  pointer-events: none;
}
@media (max-width: 640px) {
  .iz-tip { display: none; }
}
</style>
