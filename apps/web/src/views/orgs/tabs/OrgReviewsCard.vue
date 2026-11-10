<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NInput, useMessage, useDialog } from 'naive-ui';
import { Lock, Trash2 } from 'lucide-vue-next';
import type { OrgReviewItem } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { dateTime } from '@/utils/format';
import OrgCard from '../OrgCard.vue';

/** 机构评价：员工、管理员内部填写和查看；机构账号看不到（后端同样拦截） */
const props = defineProps<{ orgId: string }>();
const message = useMessage();
const dialog = useDialog();
const auth = useAuthStore();

const reviews = ref<OrgReviewItem[]>([]);
const loading = ref(false);
const draft = ref('');
const saving = ref(false);

async function load() {
  loading.value = true;
  try {
    reviews.value = await orgApi.reviews(props.orgId);
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '评价加载失败');
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function submit() {
  const content = draft.value.trim();
  if (!content) {
    message.warning('请先填写评价内容');
    return;
  }
  saving.value = true;
  try {
    await orgApi.addReview(props.orgId, content);
    draft.value = '';
    message.success('评价已保存');
    load();
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}

function canDelete(r: OrgReviewItem) {
  return auth.user?.id === r.userId || auth.user?.role === 'ADMIN';
}

function handleDelete(r: OrgReviewItem) {
  dialog.warning({
    title: '删除评价',
    content: '确定删除这条评价吗？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await orgApi.deleteReview(props.orgId, r.id);
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
  <OrgCard :title="`机构评价${reviews.length ? `（${reviews.length}）` : ''}`">
    <template #extra>
      <span class="private"><Lock :size="12" /> 仅内部可见</span>
    </template>

    <div class="composer">
      <NInput
        id="review-input"
        v-model:value="draft"
        type="textarea"
        placeholder="写下对这家机构的评价，如服务质量、配合度、学生反馈等（仅内部可见）"
        :autosize="{ minRows: 2, maxRows: 6 }"
        maxlength="1000"
        show-count
      />
      <div class="composer-actions">
        <button id="review-submit" class="btn btn-sm" :disabled="saving || !draft.trim()" @click="submit">
          {{ saving ? '保存中...' : '发布评价' }}
        </button>
      </div>
    </div>

    <div v-if="!reviews.length && !loading" class="empty text-3">还没有评价</div>
    <ul v-else class="review-list">
      <li v-for="r in reviews" :key="r.id" class="review">
        <div class="review-head">
          <span class="review-user">{{ r.userName }}</span>
          <span class="review-time num">{{ dateTime(r.createdAt) }}</span>
          <button v-if="canDelete(r)" class="icon-btn danger" title="删除" @click="handleDelete(r)">
            <Trash2 :size="13" />
          </button>
        </div>
        <div class="review-content">{{ r.content }}</div>
      </li>
    </ul>
  </OrgCard>
</template>

<style scoped>
.private {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-3);
}
.composer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
.empty {
  font-size: 13px;
  padding: 14px 0 4px;
  text-align: center;
}
.review-list {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}
.review {
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.review-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.review-user {
  font-weight: 600;
  color: var(--text);
}
.review-time {
  color: var(--text-3);
}
.review-head .icon-btn {
  margin-left: auto;
}
.review-content {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-2);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
