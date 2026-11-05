<script setup lang="ts">
import { ref, reactive } from 'vue';
import { NModal, NForm, NFormItem, NInput, NSwitch, useMessage, useDialog } from 'naive-ui';
import { ExternalLink, Plus, Pencil, Trash2 } from 'lucide-vue-next';
import CopyText from '@/components/CopyText.vue';
import WechatQr from '@/components/WechatQr.vue';
import OrgCard from '../OrgCard.vue';
import type { OrgContactItem, ContactInput } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';

const props = withDefaults(
  defineProps<{
    orgId: string;
    contacts: OrgContactItem[];
    canEdit?: boolean;
    website?: string | null;
    wechat?: string | null;
    address?: string | null;
    hasWechatQr?: boolean;
  }>(),
  { canEdit: true, website: null, wechat: null, address: null, hasWechatQr: false },
);
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
  <OrgCard title="联系方式">
    <template v-if="canEdit" #extra>
      <button class="btn-outline-sm" @click="openAdd"><Plus :size="13" /> 添加联系人</button>
    </template>

    <div v-if="!contacts.length" class="empty text-3">暂无联系人</div>

    <div v-for="c in contacts" :key="c.id" class="contact">
      <div class="contact-head">
        <span class="contact-name"><CopyText :value="c.name" label="姓名" /></span>
        <span v-if="c.title" class="text-3 contact-title">{{ c.title }}</span>
        <span v-if="c.isPrimary" class="primary">主要对接人</span>
        <span class="spacer" />
        <template v-if="canEdit">
          <button class="icon-btn" title="编辑" @click="openEdit(c)"><Pencil :size="14" /></button>
          <button class="icon-btn danger" title="删除" @click="handleDelete(c)"><Trash2 :size="14" /></button>
        </template>
      </div>
      <div class="kv-list">
        <div class="kv-row"><span class="kv-label">电话</span><span class="kv-value num"><CopyText :value="c.phone" label="电话" /></span></div>
        <div class="kv-row"><span class="kv-label">微信</span><span class="kv-value"><CopyText :value="c.wechat" label="微信号" /></span></div>
        <div v-if="c.email" class="kv-row"><span class="kv-label">邮箱</span><span class="kv-value"><CopyText :value="c.email" label="邮箱" /></span></div>
      </div>
    </div>

    <div class="kv-list org-rows">
      <div class="kv-row">
        <span class="kv-label">官网</span>
        <span class="kv-value">
          <CopyText :value="website" label="官网地址" />
          <a v-if="website" class="open-link" :href="website" target="_blank" rel="noopener noreferrer" title="打开官网"><ExternalLink :size="13" /></a>
        </span>
      </div>
      <div class="kv-row">
        <span class="kv-label">公众号</span>
        <span class="kv-value wechat-cell">
          <CopyText :value="wechat" label="公众号名称" />
          <WechatQr v-if="wechat || hasWechatQr || canEdit" :org-id="orgId" :has="hasWechatQr" :can-edit="canEdit" @changed="emit('refresh')" />
        </span>
      </div>
      <div class="kv-row"><span class="kv-label">地址</span><span class="kv-value"><CopyText :value="address" label="地址" /></span></div>
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
  </OrgCard>
</template>

<style scoped>
.open-link {
  display: inline-flex;
  vertical-align: -2px;
  margin-left: 6px;
  color: var(--text-3);
}
.open-link:hover {
  color: var(--brand);
}
.wechat-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.empty {
  font-size: 13px;
  padding: 4px 0 10px;
}
.contact {
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.contact-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}
.contact-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}
.contact-title {
  font-size: 12px;
}
.primary {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 99px;
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 500;
}
.spacer { flex: 1; }
.contact .kv-label,
.org-rows .kv-label {
  flex-basis: 72px;
}
.link {
  color: var(--brand);
  text-decoration: none;
}
.link:hover { text-decoration: underline; }
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
}
.icon-btn:hover { background: var(--neutral-soft); color: var(--text); }
.icon-btn.danger:hover { background: var(--danger-soft); color: var(--danger); }
</style>
