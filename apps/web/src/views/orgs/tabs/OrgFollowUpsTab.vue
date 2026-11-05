<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { NModal, NForm, NFormItem, NInput, NSelect, NDatePicker, NTimeline, NTimelineItem, useMessage, useDialog } from 'naive-ui';
import { Plus, Trash2, Phone, MessageCircle, Users, Mail } from 'lucide-vue-next';
import type { OrgFollowUpItem, FollowUpInput } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { date } from '@/utils/format';
import OrgCard from '../OrgCard.vue';

const props = withDefaults(defineProps<{ orgId: string; canEdit?: boolean }>(), { canEdit: true });
const message = useMessage();
const dialog = useDialog();
const auth = useAuthStore();

const followUps = ref<OrgFollowUpItem[]>([]);
const loading = ref(false);
const showForm = ref(false);
const saving = ref(false);

const methodOptions = [
  { label: '电话', value: '电话' },
  { label: '微信', value: '微信' },
  { label: '面谈', value: '面谈' },
  { label: '邮件', value: '邮件' },
];

const methodIcons: Record<string, any> = {
  '电话': Phone,
  '微信': MessageCircle,
  '面谈': Users,
  '邮件': Mail,
};

const form = reactive<{ method: string; content: string; followAt: number | null }>({
  method: '电话',
  content: '',
  followAt: Date.now(),
});

async function load() {
  loading.value = true;
  try {
    followUps.value = await orgApi.followUps(props.orgId);
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function openAdd() {
  form.method = '电话';
  form.content = '';
  form.followAt = Date.now();
  showForm.value = true;
}

async function save() {
  if (!form.content.trim()) { message.warning('内容不能为空'); return; }
  if (!form.followAt) { message.warning('请选择跟进时间'); return; }
  saving.value = true;
  try {
    await orgApi.addFollowUp(props.orgId, {
      method: form.method,
      content: form.content,
      followAt: new Date(form.followAt).toISOString(),
    });
    message.success('跟进记录已添加');
    showForm.value = false;
    load();
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '添加失败');
  } finally {
    saving.value = false;
  }
}

function handleDelete(fu: OrgFollowUpItem) {
  dialog.warning({
    title: '删除跟进记录',
    content: '确定删除此条跟进记录吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await orgApi.deleteFollowUp(props.orgId, fu.id);
        message.success('已删除');
        load();
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : '删除失败');
      }
    },
  });
}
</script>

<template>
  <OrgCard :title="`跟进记录${followUps.length ? `（${followUps.length}）` : ''}`">
    <template v-if="canEdit" #extra>
      <button class="btn-outline-sm" @click="openAdd"><Plus :size="13" /> 添加跟进</button>
    </template>

    <div v-if="!followUps.length && !loading" class="empty text-3">暂无跟进记录</div>

    <NTimeline v-else>
      <NTimelineItem v-for="fu in followUps" :key="fu.id" :time="date(fu.followAt) + ' · ' + fu.userName">
        <template #icon>
          <component :is="methodIcons[fu.method] || Phone" :size="14" />
        </template>
        <div class="fu-card">
          <div class="fu-header">
            <span class="fu-method">{{ fu.method }}</span>
            <button
              v-if="canEdit && (auth.user?.id === fu.userId || auth.user?.role === 'ADMIN')"
              class="icon-btn danger"
              title="删除"
              @click="handleDelete(fu)"
            >
              <Trash2 :size="13" />
            </button>
          </div>
          <div class="fu-content">{{ fu.content }}</div>
        </div>
      </NTimelineItem>
    </NTimeline>

    <NModal v-model:show="showForm" preset="card" title="添加跟进记录" style="max-width: 520px">
      <NForm label-placement="left" label-width="80" :show-feedback="false">
        <NFormItem label="方式" required>
          <NSelect v-model:value="form.method" :options="methodOptions" />
        </NFormItem>
        <NFormItem label="时间" required>
          <NDatePicker v-model:value="form.followAt" type="datetime" clearable style="width: 100%" />
        </NFormItem>
        <NFormItem label="内容" required>
          <NInput v-model:value="form.content" type="textarea" placeholder="记录跟进内容..." :autosize="{ minRows: 3, maxRows: 8 }" maxlength="2000" show-count />
        </NFormItem>
      </NForm>
      <template #action>
        <div style="display: flex; gap: 8px; justify-content: flex-end">
          <button class="btn btn-ghost" @click="showForm = false">取消</button>
          <button class="btn" :disabled="saving" @click="save">{{ saving ? '添加中...' : '添加' }}</button>
        </div>
      </template>
    </NModal>
  </OrgCard>
</template>

<style scoped>
.empty {
  font-size: 13px;
  padding: 18px 0;
  text-align: center;
}
.fu-card {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-top: 4px;
}
.fu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.fu-method {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 99px;
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 500;
}
.fu-content {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
  white-space: pre-wrap;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  opacity: 0;
}
.fu-card:hover .icon-btn { opacity: 1; }
.icon-btn.danger:hover { background: var(--danger-soft); color: var(--danger); }
</style>
