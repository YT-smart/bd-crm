<script setup lang="ts">
import { ref, watch } from 'vue';
import { NImage, NSpin, useDialog, useMessage } from 'naive-ui';
import { ImagePlus, QrCode, RefreshCw, Trash2 } from 'lucide-vue-next';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';

/** 公众号二维码：展示（点击放大）、上传、更换、删除 */
const props = withDefaults(defineProps<{ orgId: string; has: boolean; canEdit?: boolean; size?: number }>(), {
  canEdit: false,
  size: 72,
});
const emit = defineEmits<{ changed: [] }>();
const message = useMessage();
const dialog = useDialog();

const has = ref(props.has);
watch(() => props.has, (v) => (has.value = v));
const version = ref(Date.now());
const busy = ref(false);
const input = ref<HTMLInputElement | null>(null);

const HINT = '可登录微信公众号后台，在「设置与开发 → 账号设置」中下载二维码';

async function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (input.value) input.value.value = '';
  if (!file) return;
  if (!/\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
    message.warning('请上传 jpg / png / webp / gif 格式的图片');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    message.warning('图片不能超过 5MB');
    return;
  }
  busy.value = true;
  try {
    await orgApi.uploadWechatQr(props.orgId, file);
    has.value = true;
    version.value = Date.now();
    message.success('公众号二维码已上传');
    emit('changed');
  } catch (err) {
    message.error(err instanceof ApiError ? err.message : '上传失败');
  } finally {
    busy.value = false;
  }
}

function remove() {
  dialog.warning({
    title: '删除二维码',
    content: '确定删除公众号二维码吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await orgApi.deleteWechatQr(props.orgId);
        has.value = false;
        message.success('已删除');
        emit('changed');
      } catch (err) {
        message.error(err instanceof ApiError ? err.message : '删除失败');
      }
    },
  });
}
</script>

<template>
  <div class="qr">
    <NSpin :show="busy" size="small">
      <NImage
        v-if="has"
        class="qr-img"
        :width="size"
        :height="size"
        object-fit="contain"
        :src="orgApi.wechatQrUrl(orgId, version)"
        alt="公众号二维码"
        :img-props="{ title: '点击放大' }"
      />
      <button
        v-else-if="canEdit"
        type="button"
        class="qr-empty"
        :style="{ width: `${size}px`, height: `${size}px` }"
        title="上传公众号二维码"
        @click="input?.click()"
      >
        <ImagePlus :size="18" :stroke-width="1.6" />
        <span>上传二维码</span>
      </button>
      <div v-else class="qr-none" :style="{ width: `${size}px`, height: `${size}px` }">
        <QrCode :size="18" :stroke-width="1.5" />
        <span>未上传</span>
      </div>
    </NSpin>

    <div v-if="canEdit" class="qr-side">
      <div v-if="has" class="qr-actions">
        <button type="button" class="link-btn" :disabled="busy" @click="input?.click()"><RefreshCw :size="12" /> 更换</button>
        <button type="button" class="link-btn danger" :disabled="busy" @click="remove"><Trash2 :size="12" /> 删除</button>
      </div>
      <div class="qr-hint">{{ HINT }}</div>
    </div>
    <input ref="input" type="file" accept=".jpg,.jpeg,.png,.webp,.gif" hidden @change="onPick" />
  </div>
</template>

<style scoped>
.qr {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.qr-img {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  padding: 3px;
  cursor: zoom-in;
  display: block;
}
.qr-empty,
.qr-none {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1.5px dashed var(--border-strong);
  border-radius: 8px;
  background: var(--bg-subtle);
  color: var(--text-3);
  font-size: 11px;
  padding: 0;
}
.qr-empty {
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.qr-empty:hover {
  border-color: var(--brand);
  color: var(--brand);
}
.qr-none {
  border-style: solid;
  border-width: 1px;
  border-color: var(--border);
}
.qr-side {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.qr-actions {
  display: flex;
  gap: 12px;
}
.qr-actions .link-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
}
.qr-actions .link-btn.danger:hover {
  color: var(--danger);
}
.qr-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-3);
}
</style>
