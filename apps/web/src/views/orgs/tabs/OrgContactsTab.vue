<script setup lang="ts">
import { ref, reactive } from 'vue';
import { NModal, NForm, NFormItem, NInput, NSwitch, NEmpty, useMessage, useDialog } from 'naive-ui';
import { Plus, Pencil, Trash2, Star } from 'lucide-vue-next';
import type { OrgContactItem, ContactInput } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';

const props = withDefaults(defineProps<{ orgId: string; contacts: OrgContactItem[]; canEdit?: boolean }>(), { canEdit: true });
const emit = defineEmits<{ refresh: [] }>();
const message = useMessage();
const dialog = useDialog();

const showForm = ref(false);
const editing = ref<OrgContactItem | null>(null);
const saving = ref(false);
const form = reactive<ContactInput>({
  name: '',
  title: '',
  phone: '',
  wechat: '',
  email: '',
  isPrimary: false,
});

function openAdd() {
  editing.value = null;
  Object.assign(form, { name: '', title: '', phone: '', wechat: '', email: '', isPrimary: false });
  showForm.value = true;
}

function openEdit(c: OrgContactItem) {
  editing.value = c;
  Object.assign(form, {
    name: c.name,
    title: c.title ?? '',
    phone: c.phone ?? '',
    wechat: c.wechat ?? '',
    email: c.email ?? '',
    isPrimary: c.isPrimary,
  });
  showForm.value = true;
}

async function save() {
  if (!form.name.trim()) { message.warning('姓名不能为空'); return; }
  saving.value = true;
  try {
    if (editing.value) {
      await orgApi.updateContact(props.orgId, editing.value.id, {
        name: form.name,
        title: form.title || null,
        phone: form.phone || null,
        wechat: form.wechat || null,
        email: form.email || null,
        isPrimary: form.isPrimary,
      });
      message.success('联系人已更新');
    } else {
      await orgApi.addContact(props.orgId, form);
      message.success('联系人已添加');
    }
    showForm.value = false;
    emit('refresh');
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '操作失败');
  } finally {
    saving.value = false;
  }
}

function handleDelete(c: OrgContactItem) {
  dialog.warning({
    title: '删除联系人',
    content: `确定删除联系人"${c.name}"吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await orgApi.deleteContact(props.orgId, c.id);
        message.success('已删除');
        emit('refresh');
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : '删除失败');
      }
    },
  });
}
</script>

<template>
  <div>
    <div class="tab-header">
      <span class="text-2">共 {{ contacts.length }} 个联系人</span>
      <button v-if="canEdit" class="btn btn-sm" @click="openAdd"><Plus :size="14" /> 添加联系人</button>
    </div>

    <NEmpty v-if="!contacts.length" description="暂无联系人" style="margin-top: 40px" />

    <div v-else class="contact-list">
      <div v-for="c in contacts" :key="c.id" class="contact-card">
        <div class="contact-main">
          <div class="contact-name">
            <Star v-if="c.isPrimary" :size="14" fill="var(--brand)" color="var(--brand)" />
            {{ c.name }}
            <span v-if="c.title" class="text-3">{{ c.title }}</span>
          </div>
          <div class="contact-detail text-2">
            <span v-if="c.phone">{{ c.phone }}</span>
            <span v-if="c.wechat">微信: {{ c.wechat }}</span>
            <span v-if="c.email">{{ c.email }}</span>
          </div>
        </div>
        <div v-if="canEdit" class="contact-actions">
          <button class="icon-btn" title="编辑" @click="openEdit(c)"><Pencil :size="14" /></button>
          <button class="icon-btn danger" title="删除" @click="handleDelete(c)"><Trash2 :size="14" /></button>
        </div>
      </div>
    </div>

    <NModal v-model:show="showForm" preset="card" :title="editing ? '编辑联系人' : '添加联系人'" style="max-width: 480px">
      <NForm label-placement="left" label-width="60" :show-feedback="false">
        <NFormItem label="姓名" required>
          <NInput v-model:value="form.name" placeholder="姓名" maxlength="30" />
        </NFormItem>
        <NFormItem label="职务">
          <NInput v-model:value="form.title" placeholder="职务" maxlength="50" />
        </NFormItem>
        <NFormItem label="电话">
          <NInput v-model:value="form.phone" placeholder="电话" maxlength="20" />
        </NFormItem>
        <NFormItem label="微信">
          <NInput v-model:value="form.wechat" placeholder="微信号" maxlength="50" />
        </NFormItem>
        <NFormItem label="邮箱">
          <NInput v-model:value="form.email" placeholder="邮箱" maxlength="100" />
        </NFormItem>
        <NFormItem label="主要">
          <NSwitch v-model:value="form.isPrimary" />
        </NFormItem>
      </NForm>
      <template #action>
        <div style="display: flex; gap: 8px; justify-content: flex-end">
          <button class="btn btn-ghost" @click="showForm = false">取消</button>
          <button class="btn" :disabled="saving" @click="save">{{ saving ? '保存中...' : '保存' }}</button>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.contact-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.contact-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.contact-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}
.contact-detail {
  display: flex;
  gap: 16px;
  margin-top: 4px;
  font-size: 13px;
}
.contact-actions {
  display: flex;
  gap: 4px;
  opacity: 0.5;
}
.contact-card:hover .contact-actions {
  opacity: 1;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
}
.icon-btn:hover {
  background: var(--neutral-soft);
}
.icon-btn.danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}
</style>
