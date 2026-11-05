<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { NSpin } from 'naive-ui';
import { Download, FileQuestion, X } from 'lucide-vue-next';

/**
 * 附件在线查看：图片 / PDF / 纯文本 / Word(docx) / Excel(xlsx、xls)。
 * 文件拉取为 Blob 后在页面内渲染。弹窗预览（AttachmentPreview）与分享页共用。
 */
const props = withDefaults(defineProps<{ name: string; url: string; downloadUrl: string; closable?: boolean }>(), {
  closable: true,
});
const emit = defineEmits<{ close: [] }>();

type Kind = 'image' | 'pdf' | 'text' | 'docx' | 'sheet' | 'none';
const ext = computed(() => props.name.split('.').pop()?.toLowerCase() ?? '');
const kind = computed<Kind>(() => previewKind(props.name));

const loading = ref(false);
const error = ref('');
const blobUrl = ref('');
const text = ref('');
const docxEl = ref<HTMLDivElement | null>(null);
const sheets = ref<{ name: string; rows: unknown[][]; truncated: boolean }[]>([]);
const activeSheet = ref(0);

const MAX_ROWS = 1000;
let seq = 0;

function cleanup() {
  if (blobUrl.value) URL.revokeObjectURL(blobUrl.value);
  blobUrl.value = '';
  text.value = '';
  sheets.value = [];
  activeSheet.value = 0;
  error.value = '';
  if (docxEl.value) docxEl.value.innerHTML = '';
}

async function load() {
  const my = ++seq;
  cleanup();
  if (kind.value === 'none') return;
  loading.value = true;
  try {
    const res = await fetch(props.url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(res.status === 404 ? '文件已丢失' : `加载失败（${res.status}）`);
    const blob = await res.blob();
    if (my !== seq) return;

    if (kind.value === 'image') {
      blobUrl.value = URL.createObjectURL(blob);
    } else if (kind.value === 'pdf') {
      blobUrl.value = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    } else if (kind.value === 'text') {
      text.value = await blob.text();
    } else if (kind.value === 'docx') {
      const { renderAsync } = await import('docx-preview');
      await nextTick();
      if (my !== seq || !docxEl.value) return;
      await renderAsync(blob, docxEl.value, undefined, {
        className: 'docx-pv',
        inWrapper: true,
        ignoreLastRenderedPageBreak: true,
      });
    } else if (kind.value === 'sheet') {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array', cellDates: true });
      sheets.value = wb.SheetNames.map((n) => {
        const all = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n]!, { header: 1, raw: false, defval: '' });
        return { name: n, rows: all.slice(0, MAX_ROWS), truncated: all.length > MAX_ROWS };
      });
    }
  } catch (e) {
    if (my === seq) error.value = e instanceof Error ? e.message : '预览失败';
  } finally {
    if (my === seq) loading.value = false;
  }
}

watch(() => props.url, load);
onMounted(load);
onBeforeUnmount(() => {
  seq++;
  cleanup();
});

const current = computed(() => sheets.value[activeSheet.value]);
</script>

<script lang="ts">
/** 判断附件能否在线预览 */
export function previewKind(name: string): 'image' | 'pdf' | 'text' | 'docx' | 'sheet' | 'none' {
  const e = name.split('.').pop()?.toLowerCase() ?? '';
  if (/^(jpg|jpeg|png|webp|gif)$/.test(e)) return 'image';
  if (e === 'pdf') return 'pdf';
  if (e === 'txt') return 'text';
  if (e === 'docx') return 'docx';
  if (e === 'xlsx' || e === 'xls') return 'sheet';
  return 'none';
}
</script>

<template>
    <div class="pv card">
      <header class="pv-head">
        <div class="pv-name" :title="name">{{ name }}</div>
        <a class="pv-btn" :href="downloadUrl" title="下载"><Download :size="16" :stroke-width="1.75" /> 下载</a>
        <slot name="actions" />
        <button v-if="closable" class="pv-btn icon" title="关闭" @click="emit('close')"><X :size="18" :stroke-width="1.75" /></button>
      </header>

      <div :class="['pv-body', `pv-${kind}`]">
        <div v-if="loading" class="pv-center"><NSpin size="medium" /></div>
        <div v-if="error" class="pv-center pv-msg">{{ error }}</div>

        <div v-if="kind === 'none'" class="pv-center pv-msg">
          <FileQuestion :size="32" :stroke-width="1.4" />
          <div>.{{ ext }} 格式暂不支持在线预览，请下载后查看</div>
        </div>

        <img v-else-if="kind === 'image' && blobUrl" class="pv-img" :src="blobUrl" :alt="name" />
        <iframe v-else-if="kind === 'pdf' && blobUrl" class="pv-frame" :src="blobUrl" :title="name" />
        <pre v-else-if="kind === 'text' && !loading && !error" class="pv-text">{{ text }}</pre>
        <div v-show="kind === 'docx' && !error" ref="docxEl" class="pv-docx" />
        <div v-if="kind === 'sheet' && current" class="pv-sheet">
          <div v-if="sheets.length > 1" class="sheet-tabs">
            <button
              v-for="(s, i) in sheets"
              :key="s.name"
              :class="['sheet-tab', { active: i === activeSheet }]"
              @click="activeSheet = i"
            >
              {{ s.name }}
            </button>
          </div>
          <div class="sheet-scroll">
            <table v-if="current.rows.length" class="sheet-table">
              <tbody>
                <tr v-for="(r, ri) in current.rows" :key="ri">
                  <th class="rn">{{ ri + 1 }}</th>
                  <td v-for="(c, ci) in r" :key="ci">{{ c }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="pv-center pv-msg">此工作表为空</div>
          </div>
          <div v-if="current.truncated" class="sheet-note">仅预览前 {{ MAX_ROWS }} 行，完整内容请下载查看</div>
        </div>
      </div>
    </div>
</template>

<style scoped>
.pv {
  width: min(1100px, calc(100vw - 48px));
  height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pv-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.pv-name {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pv-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
}
.pv-btn.icon { padding: 0 6px; }
.pv-btn:hover { background: var(--neutral-soft); color: var(--brand); }
.pv-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--bg-subtle, #f6f7f9);
}
.pv-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
}
.pv-msg {
  color: var(--text-2);
  font-size: 14px;
}
.pv-image {
  display: flex;
  align-items: center;
  justify-content: center;
}
.pv-img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  margin: auto;
  object-fit: contain;
}
.pv-pdf { overflow: hidden; }
.pv-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.pv-text {
  margin: 0;
  padding: 20px 24px;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.pv-docx :deep(.docx-pv-wrapper) {
  background: transparent;
  padding: 20px;
}
.pv-docx :deep(.docx-pv-wrapper > section.docx-pv) {
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.12);
  margin-bottom: 20px;
}
.pv-sheet {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.sheet-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px 0;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  overflow-x: auto;
  flex-shrink: 0;
}
.sheet-tab {
  padding: 6px 12px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
}
.sheet-tab.active { color: var(--brand); border-bottom-color: var(--brand); font-weight: 500; }
.sheet-scroll {
  position: relative;
  flex: 1;
  overflow: auto;
  background: var(--surface);
}
.sheet-table {
  border-collapse: collapse;
  font-size: 12.5px;
  color: var(--text);
}
.sheet-table td,
.sheet-table th {
  border: 1px solid var(--border);
  padding: 5px 10px;
  white-space: nowrap;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sheet-table .rn {
  position: sticky;
  left: 0;
  background: var(--neutral-soft);
  color: var(--text-3);
  font-weight: 400;
  text-align: center;
  min-width: 40px;
}
.sheet-note {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--warning);
  border-top: 1px solid var(--border);
  background: var(--surface);
}
</style>
