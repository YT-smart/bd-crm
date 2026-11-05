<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { NSpin } from 'naive-ui';
import { Download, FileQuestion } from 'lucide-vue-next';
import { shareApi, type SharedFileMeta } from '@/api';
import { ApiError } from '@/api/http';
import AttachmentViewer, { previewKind } from '@/components/AttachmentViewer.vue';

/** 附件分享页：免登录查看 / 下载单个附件 */
const route = useRoute();
const token = computed(() => String(route.params.token ?? ''));

const meta = ref<SharedFileMeta | null>(null);
const error = ref('');
const loading = ref(true);

shareApi
  .meta(token.value)
  .then((m) => {
    meta.value = m;
    document.title = `${m.name} - 文件分享`;
  })
  .catch((e) => (error.value = e instanceof ApiError ? e.message : '链接无法打开'))
  .finally(() => (loading.value = false));

const canPreview = computed(() => !!meta.value && previewKind(meta.value.name) !== 'none');
</script>

<template>
  <div class="share">
    <div v-if="loading" class="center"><NSpin /></div>

    <div v-else-if="error" class="center card msg">
      <FileQuestion :size="36" :stroke-width="1.4" />
      <div class="msg-title">{{ error }}</div>
      <div class="text-3">请联系分享人重新获取链接</div>
    </div>

    <template v-else-if="meta">
      <AttachmentViewer
        v-if="canPreview"
        class="viewer"
        :name="meta.name"
        :url="shareApi.fileUrl(token, true)"
        :download-url="shareApi.fileUrl(token)"
        :closable="false"
      />
      <div v-else class="center card msg">
        <FileQuestion :size="36" :stroke-width="1.4" />
        <div class="msg-title">{{ meta.name }}</div>
        <div class="text-3">该格式暂不支持在线预览，请下载后查看</div>
        <a class="btn" :href="shareApi.fileUrl(token)"><Download :size="15" /> 下载文件</a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.share {
  min-height: 100vh;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg);
  box-sizing: border-box;
}
.viewer {
  margin: 0 auto;
  height: calc(100vh - 32px) !important;
}
.center {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.msg {
  padding: 40px 48px;
  color: var(--text-2);
  text-align: center;
  max-width: 420px;
}
.msg-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  word-break: break-all;
}
</style>
