<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { NSelect, NProgress, NSkeleton, useDialog, useMessage } from 'naive-ui';
import {
  Download, Eye, File as FileIcon, FileArchive, FileImage, FileSpreadsheet, FileText, Presentation, Trash2, UploadCloud,
} from 'lucide-vue-next';
import {
  ATTACHMENT_CATEGORY_LABEL,
  ATTACHMENT_MAX_MB,
  AttachmentCategory,
  type OrgAttachmentItem,
} from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { date } from '@/utils/format';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{ orgId: string; canEdit: boolean }>();
const message = useMessage();
const dialog = useDialog();
const auth = useAuthStore();

const list = ref<OrgAttachmentItem[]>([]);
const loading = ref(true);
const filter = ref<AttachmentCategory | 'ALL'>('ALL');

const uploadCategory = ref<AttachmentCategory>(AttachmentCategory.LICENSE);
const uploading = ref(false);
const progress = ref(0);
const dragOver = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp,.gif,.zip,.rar,.7z';
const categories = Object.keys(ATTACHMENT_CATEGORY_LABEL) as AttachmentCategory[];
const categoryOptions = categories.map((c) => ({ label: ATTACHMENT_CATEGORY_LABEL[c], value: c }));

const counts = computed(() => {
  const m: Record<string, number> = { ALL: list.value.length };
  for (const a of list.value) m[a.category] = (m[a.category] ?? 0) + 1;
  return m;
});
const filtered = computed(() => (filter.value === 'ALL' ? list.value : list.value.filter((a) => a.category === filter.value)));

async function load() {
  loading.value = true;
  try {
    list.value = await orgApi.attachments(props.orgId);
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '加载附件失败');
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function upload(files: File[]) {
  if (!files.length || uploading.value) return;
  const tooBig = files.find((f) => f.size > ATTACHMENT_MAX_MB * 1024 * 1024);
  if (tooBig) {
    message.warning(`"${tooBig.name}" 超过 ${ATTACHMENT_MAX_MB}MB`);
    return;
  }
  if (files.length > 10) {
    message.warning('一次最多上传 10 个文件');
    return;
  }
  uploading.value = true;
  progress.value = 0;
  try {
    const added = await orgApi.uploadAttachments(props.orgId, uploadCategory.value, files, (p) => (progress.value = p));
    list.value = [...added, ...list.value];
    message.success(`已上传 ${added.length} 个文件`);
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '上传失败');
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function onPick(e: Event) {
  upload(Array.from((e.target as HTMLInputElement).files ?? []));
}
function onDrop(e: DragEvent) {
  dragOver.value = false;
  if (!props.canEdit) return;
  upload(Array.from(e.dataTransfer?.files ?? []));
}

function remove(a: OrgAttachmentItem) {
  dialog.warning({
    title: '删除附件',
    content: `确定删除"${a.name}"吗？删除后无法恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await orgApi.deleteAttachment(props.orgId, a.id);
        list.value = list.value.filter((x) => x.id !== a.id);
        message.success('已删除');
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : '删除失败');
      }
    },
  });
}

/* ---------- 展示辅助 ---------- */
const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const isImage = (a: OrgAttachmentItem) => /^(jpg|jpeg|png|webp|gif)$/.test(ext(a.name));
const canPreview = (a: OrgAttachmentItem) => isImage(a) || ext(a.name) === 'pdf' || ext(a.name) === 'txt';

function iconOf(a: OrgAttachmentItem) {
  const e = ext(a.name);
  if (isImage(a)) return FileImage;
  if (e === 'pdf' || e === 'doc' || e === 'docx' || e === 'txt') return FileText;
  if (e === 'xls' || e === 'xlsx') return FileSpreadsheet;
  if (e === 'ppt' || e === 'pptx') return Presentation;
  if (e === 'zip' || e === 'rar' || e === '7z') return FileArchive;
  return FileIcon;
}
function toneOf(a: OrgAttachmentItem) {
  const e = ext(a.name);
  if (e === 'pdf') return 'danger';
  if (e === 'doc' || e === 'docx') return 'info';
  if (e === 'xls' || e === 'xlsx') return 'success';
  if (e === 'ppt' || e === 'pptx') return 'warning';
  return 'brand';
}
function size(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
const url = (a: OrgAttachmentItem, inline = false) => orgApi.attachmentUrl(props.orgId, a.id, inline);

/** 机构账号只能删除自己上传的附件 */
const canDelete = (a: OrgAttachmentItem) =>
  props.canEdit && (auth.user?.role !== 'ORG' || a.uploadedById === auth.user?.id);
</script>

<template>
  <div class="att">
    <!-- 上传区 -->
    <div
      v-if="canEdit"
      :class="['drop', { over: dragOver, busy: uploading }]"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div class="drop-icon"><UploadCloud :size="22" :stroke-width="1.6" /></div>
      <div class="drop-main">
        <template v-if="uploading">
          <div class="drop-title">正在上传... {{ progress }}%</div>
          <NProgress type="line" :percentage="progress" :show-indicator="false" :height="4" color="var(--brand)" style="margin-top: 8px; max-width: 320px" />
        </template>
        <template v-else>
          <div class="drop-title">拖拽文件到这里，或 <button class="drop-link" @click="fileInput?.click()">点击选择文件</button></div>
          <div class="drop-sub">支持 PDF / Word / Excel / PPT / 图片 / 压缩包，单个不超过 {{ ATTACHMENT_MAX_MB }}MB，一次最多 10 个</div>
        </template>
      </div>
      <div class="drop-side">
        <span class="text-3 side-label">归类为</span>
        <NSelect id="att-category" v-model:value="uploadCategory" :options="categoryOptions" size="small" style="width: 120px" :disabled="uploading" />
      </div>
      <input ref="fileInput" type="file" multiple :accept="ACCEPT" hidden @change="onPick" />
    </div>

    <!-- 分类筛选 -->
    <div class="chips">
      <button :class="['chip', { active: filter === 'ALL' }]" @click="filter = 'ALL'">
        全部 <span class="chip-n">{{ counts.ALL ?? 0 }}</span>
      </button>
      <button
        v-for="c in categories"
        :key="c"
        :class="['chip', { active: filter === c }]"
        @click="filter = c"
      >
        {{ ATTACHMENT_CATEGORY_LABEL[c] }} <span class="chip-n">{{ counts[c] ?? 0 }}</span>
      </button>
    </div>

    <!-- 列表 -->
    <div v-if="loading" class="grid">
      <NSkeleton v-for="i in 4" :key="i" height="76px" :sharp="false" />
    </div>

    <div v-else-if="!filtered.length" class="empty">
      <FileIcon :size="28" :stroke-width="1.4" />
      <div>{{ filter === 'ALL' ? '还没有上传任何附件' : `暂无「${ATTACHMENT_CATEGORY_LABEL[filter]}」类附件` }}</div>
      <div v-if="canEdit" class="text-3 empty-sub">营业执照、机构介绍、成功案例等资料可以在这里统一归档</div>
    </div>

    <div v-else class="grid">
      <div v-for="a in filtered" :key="a.id" class="file">
        <a v-if="isImage(a)" class="thumb img" :href="url(a, true)" target="_blank" rel="noopener">
          <img :src="url(a, true)" :alt="a.name" loading="lazy" />
        </a>
        <div v-else :class="['thumb', `tone-${toneOf(a)}`]">
          <component :is="iconOf(a)" :size="20" :stroke-width="1.6" />
          <span class="thumb-ext">{{ ext(a.name).toUpperCase() }}</span>
        </div>

        <div class="file-body">
          <div class="file-name" :title="a.name">{{ a.name }}</div>
          <div class="file-meta">
            <span class="cat">{{ ATTACHMENT_CATEGORY_LABEL[a.category as AttachmentCategory] ?? a.category }}</span>
            <span>{{ size(a.size) }}</span>
            <span>{{ date(a.createdAt) }}</span>
            <span v-if="a.uploadedByName">{{ a.uploadedByName }}</span>
          </div>
        </div>

        <div class="file-actions">
          <a v-if="canPreview(a)" class="icon-btn" :href="url(a, true)" target="_blank" rel="noopener" title="预览">
            <Eye :size="15" :stroke-width="1.75" />
          </a>
          <a class="icon-btn" :href="url(a)" title="下载"><Download :size="15" :stroke-width="1.75" /></a>
          <button v-if="canDelete(a)" class="icon-btn danger" title="删除" @click="remove(a)">
            <Trash2 :size="15" :stroke-width="1.75" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.drop {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--bg-subtle);
  transition: border-color 0.2s var(--ease), background-color 0.2s var(--ease);
}
.drop.over {
  border-color: var(--brand);
  background: var(--brand-soft);
}
.drop-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--brand);
  flex-shrink: 0;
}
.drop.over .drop-icon {
  transform: translateY(-2px);
  transition: transform 0.2s var(--ease);
}
.drop-main {
  flex: 1;
  min-width: 0;
}
.drop-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text);
}
.drop-link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--brand);
  font-weight: 500;
  cursor: pointer;
}
.drop-link:hover {
  text-decoration: underline;
}
.drop-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-3);
}
.drop-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.side-label {
  font-size: 12px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 18px 0 14px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.15s var(--ease);
}
.chip:hover {
  border-color: var(--border-strong);
  color: var(--text);
}
.chip.active {
  border-color: var(--brand);
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 500;
}
.chip-n {
  font-size: 11px;
  min-width: 16px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--neutral-soft);
  color: var(--text-3);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.chip.active .chip-n {
  background: var(--surface);
  color: var(--brand);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 10px;
}
.file {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  transition: border-color 0.15s var(--ease), box-shadow 0.15s var(--ease);
}
.file:hover {
  border-color: var(--border-strong);
  box-shadow: 0 4px 14px -6px rgba(15, 23, 42, 0.12);
}
.thumb {
  position: relative;
  display: grid;
  place-items: center;
  width: 48px;
  height: 52px;
  border-radius: 8px;
  flex-shrink: 0;
  overflow: hidden;
}
.thumb.img {
  background: var(--neutral-soft);
  border: 1px solid var(--border);
}
.thumb.img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.thumb-ext {
  position: absolute;
  bottom: 4px;
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.3px;
}
.thumb svg {
  margin-bottom: 8px;
}
.tone-brand { background: var(--brand-soft); color: var(--brand); }
.tone-danger { background: var(--danger-soft); color: var(--danger); }
.tone-info { background: var(--info-soft); color: var(--info); }
.tone-success { background: var(--success-soft); color: var(--success); }
.tone-warning { background: var(--warning-soft); color: var(--warning); }

.file-body {
  flex: 1;
  min-width: 0;
}
.file-name {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-3);
}
.cat {
  color: var(--brand);
}
.file-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.file:hover .file-actions,
.file:focus-within .file-actions {
  opacity: 1;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 0;
  color: var(--text-2);
  font-size: 14px;
}
.empty svg {
  color: var(--text-3);
}
.empty-sub {
  font-size: 12px;
}

@media (max-width: 720px) {
  .drop {
    flex-wrap: wrap;
  }
  .file-actions {
    opacity: 1;
  }
}
</style>
