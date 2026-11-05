<script setup lang="ts">
import { ref } from 'vue';
import { useMessage } from 'naive-ui';
import { Link2 } from 'lucide-vue-next';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { copyText } from '@/utils/clipboard';

/** 生成附件的免登录分享链接并复制到剪贴板 */
const props = defineProps<{ orgId: string; attId: string; label?: string }>();
const message = useMessage();
const busy = ref(false);

/** 链接长期有效（附件删除后失效） */
async function share() {
  if (busy.value) return;
  busy.value = true;
  try {
    const { token } = await orgApi.shareAttachment(props.orgId, props.attId, 0);
    const link = `${location.origin}/s/${token}`;
    const ok = await copyText(link);
    if (ok) message.success('分享链接已复制，对方无需登录即可查看');
    else message.info(`请手动复制：${link}`, { duration: 10000, closable: true });
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '生成分享链接失败');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <button :class="label ? 'pv-share' : 'icon-btn'" title="复制分享链接" :disabled="busy" @click.stop="share">
    <Link2 :size="15" :stroke-width="1.75" />
    <span v-if="label">{{ label }}</span>
  </button>
</template>

<style scoped>
.pv-share {
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
  cursor: pointer;
}
.pv-share:hover {
  background: var(--neutral-soft);
  color: var(--brand);
}
</style>
