<script setup lang="ts">
import { computed, h, reactive, ref, watch, onMounted } from 'vue';
import {
  NDataTable, NInput, NSelect, NSwitch, NModal,
  NForm, NFormItem, NTag, useMessage, useDialog,
  type DataTableColumns,
} from 'naive-ui';
import { useDebounceFn } from '@vueuse/core';
import {
  Key, Pencil, Plus, RotateCcw, Search,
  ShieldCheck, Trash2, UserCheck, UserX,
} from 'lucide-vue-next';
import { Role, ROLE_LABEL } from '@bdcrm/shared';
import { userApi, orgApi, type UserItem, type UserQuery } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import { date } from '@/utils/format';

const message = useMessage();
const dialog = useDialog();
const auth = useAuthStore();

/** 与后端 PASSWORD_RULE 保持一致 */
const PWD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;
const PWD_TIP = '密码至少 8 位，且同时包含字母和数字';

const roleOptions = (Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ label: ROLE_LABEL[r], value: r }));
const activeOptions = [
  { label: '全部', value: null as any },
  { label: '正常', value: 'true' },
  { label: '已停用', value: 'false' },
];

/* ---------- 筛选 ---------- */
const filters = reactive({ keyword: '', role: null as string | null, isActive: null as string | null, page: 1 });
const pageSize = ref(20);
const rows = ref<UserItem[]>([]);
const total = ref(0);
const loading = ref(false);

let seq = 0;
async function load() {
  const my = ++seq;
  loading.value = true;
  try {
    const res = await userApi.list({
      page: filters.page,
      pageSize: pageSize.value,
      keyword: filters.keyword || undefined,
      role: filters.role ?? undefined,
      isActive: filters.isActive ?? undefined,
    });
    if (my !== seq) return;
    rows.value = res.list;
    total.value = res.total;
  } catch (e) {
    if (my === seq) message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    if (my === seq) loading.value = false;
  }
}

const debouncedKeyword = useDebounceFn(() => { filters.page = 1; load(); }, 300);
watch(() => filters.keyword, debouncedKeyword);
watch(() => [filters.role, filters.isActive], () => { filters.page = 1; load(); });

function reset() { Object.assign(filters, { keyword: '', role: null, isActive: null, page: 1 }); }
const hasFilter = computed(() => !!(filters.keyword || filters.role || filters.isActive));

/* ---------- 机构选项 ---------- */
const orgOptions = ref<Array<{ label: string; value: string }>>([]);
onMounted(async () => {
  load();
  try {
    const staff = await orgApi.staffOptions();
    // 加载机构选项用于创建机构账号时绑定
  } catch {}
  try {
    const res = await orgApi.list({ page: 1, pageSize: 200 });
    orgOptions.value = res.list.map((o) => ({ label: o.name, value: o.id }));
  } catch {}
});

/* ---------- 创建/编辑弹窗 ---------- */
const showForm = ref(false);
const editing = ref<UserItem | null>(null);
const saving = ref(false);
const form = reactive({
  username: '',
  name: '',
  role: 'STAFF' as string,
  orgId: null as string | null,
  phone: '',
  email: '',
  password: '',
});

function openCreate() {
  editing.value = null;
  Object.assign(form, { username: '', name: '', role: 'STAFF', orgId: null, phone: '', email: '', password: '' });
  showForm.value = true;
}

function openEdit(u: UserItem) {
  editing.value = u;
  Object.assign(form, {
    username: u.username,
    name: u.name,
    role: u.role,
    orgId: u.orgId,
    phone: u.phone ?? '',
    email: u.email ?? '',
    password: '',
  });
  showForm.value = true;
}

async function save() {
  if (!editing.value) {
    // 创建
    if (!form.username.trim()) { message.warning('请输入用户名'); return; }
    if (!form.name.trim()) { message.warning('请输入姓名'); return; }
    if (!form.password) { message.warning('请输入密码'); return; }
    if (!PWD_RULE.test(form.password)) { message.warning(PWD_TIP); return; }
    saving.value = true;
    try {
      await userApi.create({
        username: form.username.trim(),
        name: form.name.trim(),
        role: form.role,
        orgId: form.role === 'ORG' ? form.orgId : undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        password: form.password,
      });
      message.success('账号已创建');
      showForm.value = false;
      load();
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '创建失败');
    } finally {
      saving.value = false;
    }
  } else {
    // 编辑
    saving.value = true;
    try {
      await userApi.update(editing.value.id, {
        name: form.name.trim(),
        role: form.role,
        orgId: form.role === 'ORG' ? form.orgId : null,
        phone: form.phone || null,
        email: form.email || null,
      });
      message.success('已更新');
      showForm.value = false;
      load();
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '更新失败');
    } finally {
      saving.value = false;
    }
  }
}

/* ---------- 启用/停用 ---------- */
async function toggleActive(u: UserItem) {
  try {
    const res = await userApi.toggleActive(u.id, !u.isActive);
    message.success(res.isActive ? '已启用' : '已停用');
    load();
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '操作失败');
  }
}

/* ---------- 重置密码 ---------- */
function handleResetPwd(u: UserItem) {
  const pwd = ref('Abc12345');
  dialog.info({
    title: '重置密码',
    content: () => h('div', [
      h('p', `将重置"${u.name}"的密码，登录后须修改。`),
      h(NInput, { value: pwd.value, 'onUpdate:value': (v: string) => { pwd.value = v; }, placeholder: '新密码', type: 'password', showPasswordOn: 'click' }),
    ]),
    positiveText: '确认重置',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (!PWD_RULE.test(pwd.value)) { message.warning(PWD_TIP); return false; }
      try {
        await userApi.resetPassword(u.id, pwd.value);
        message.success('密码已重置');
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : '操作失败');
      }
    },
  });
}

/* ---------- 删除 ---------- */
function handleDelete(u: UserItem) {
  dialog.warning({
    title: '删除账号',
    content: `确定删除账号"${u.name}（${u.username}）"？此操作不可撤销。`,
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await userApi.remove(u.id);
        message.success('已删除');
        load();
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : '删除失败');
      }
    },
  });
}

/* ---------- 表格列 ---------- */
const columns = computed<DataTableColumns<UserItem>>(() => [
  {
    title: '用户名',
    key: 'username',
    width: 130,
    render: (r) => h('span', { class: 'text-bold num' }, r.username),
  },
  { title: '姓名', key: 'name', width: 120, ellipsis: { tooltip: true }, render: (r) => r.name },
  {
    title: '角色',
    key: 'role',
    width: 90,
    render: (r) => {
      const toneMap: Record<string, string> = { ADMIN: 'error', STAFF: 'info', ORG: 'success' };
      return h(NTag, { size: 'small', type: (toneMap[r.role] ?? 'default') as any, bordered: false }, () => ROLE_LABEL[r.role as Role] ?? r.role);
    },
  },
  {
    title: '绑定机构',
    key: 'orgName',
    width: 160,
    ellipsis: { tooltip: true },
    render: (r) => r.orgName ?? '--',
  },
  { title: '手机号', key: 'phone', width: 130, render: (r) => h('span', { class: 'num' }, r.phone ?? '--') },
  {
    title: '状态',
    key: 'isActive',
    width: 80,
    render: (r) => r.isActive
      ? h(NTag, { size: 'small', type: 'success', bordered: false }, () => '正常')
      : h(NTag, { size: 'small', type: 'error', bordered: false }, () => '停用'),
  },
  {
    title: '最后登录',
    key: 'lastLoginAt',
    width: 120,
    render: (r) => h('span', { class: 'num text-3', style: 'white-space: nowrap' }, r.lastLoginAt ? date(r.lastLoginAt) : '从未'),
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 120,
    render: (r) => h('span', { class: 'num text-3', style: 'white-space: nowrap' }, date(r.createdAt)),
  },
  {
    title: '操作',
    key: 'actions',
    width: 280,
    fixed: 'right',
    render: (r) => {
      const isSelf = r.id === auth.user?.id;
      return h('div', { class: 'actions-row' }, [
        h('button', { class: 'link-btn sm', onClick: () => openEdit(r), disabled: isSelf }, [h(Pencil, { size: 13 }), ' 编辑']),
        h('button', { class: 'link-btn sm', onClick: () => toggleActive(r), disabled: isSelf }, [
          r.isActive ? h(UserX, { size: 13 }) : h(UserCheck, { size: 13 }),
          r.isActive ? ' 停用' : ' 启用',
        ]),
        h('button', { class: 'link-btn sm', onClick: () => handleResetPwd(r) }, [h(Key, { size: 13 }), ' 重置']),
        h('button', { class: 'link-btn sm text-danger', onClick: () => handleDelete(r), disabled: isSelf }, [h(Trash2, { size: 13 }), ' 删除']),
      ]);
    },
  },
]);

const pagination = computed(() => ({
  page: filters.page,
  pageSize: pageSize.value,
  itemCount: total.value,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
  prefix: () => `共 ${total.value} 个`,
}));
</script>

<template>
  <div class="page">
    <div class="card toolbar rise-in">
      <NInput v-model:value="filters.keyword" placeholder="搜索用户名、姓名、手机号" clearable class="search">
        <template #prefix><Search :size="16" :stroke-width="1.75" class="text-3" /></template>
      </NInput>
      <NSelect v-model:value="filters.role" :options="roleOptions" placeholder="角色" clearable class="sel sm" />
      <NSelect v-model:value="filters.isActive" :options="activeOptions" placeholder="状态" clearable class="sel sm" />
      <button v-if="hasFilter" class="link-btn reset" @click="reset"><RotateCcw :size="14" /> 重置</button>

      <div class="toolbar-right">
        <button class="btn btn-sm" @click="openCreate">
          <Plus :size="14" /> 新增账号
        </button>
      </div>
    </div>

    <div class="card table-card rise-in" style="animation-delay: 40ms">
      <NDataTable
        remote
        :columns="columns"
        :data="rows"
        :loading="loading"
        :pagination="pagination"
        :bordered="false"
        :row-key="(r: UserItem) => r.id"
        :scroll-x="1200"
        @update:page="(p) => { filters.page = p; load(); }"
        @update:page-size="(s) => { pageSize = s; filters.page = 1; load(); }"
      />
    </div>

    <!-- 创建/编辑弹窗 -->
    <NModal v-model:show="showForm" preset="card" :title="editing ? '编辑账号' : '新增账号'" style="max-width: 500px">
      <NForm label-placement="left" label-width="70" :show-feedback="false">
        <NFormItem label="用户名" required>
          <NInput v-model:value="form.username" :disabled="!!editing" placeholder="登录用户名" maxlength="30" />
        </NFormItem>
        <NFormItem label="姓名" required>
          <NInput v-model:value="form.name" placeholder="显示名称" maxlength="20" />
        </NFormItem>
        <NFormItem label="角色" required>
          <NSelect v-model:value="form.role" :options="roleOptions" />
        </NFormItem>
        <NFormItem v-if="form.role === 'ORG'" label="绑定机构">
          <NSelect v-model:value="form.orgId" :options="orgOptions" clearable filterable placeholder="选择机构" />
        </NFormItem>
        <NFormItem label="手机号">
          <NInput v-model:value="form.phone" placeholder="手机号" maxlength="20" />
        </NFormItem>
        <NFormItem label="邮箱">
          <NInput v-model:value="form.email" placeholder="邮箱" maxlength="100" />
        </NFormItem>
        <NFormItem v-if="!editing" label="密码" required>
          <NInput v-model:value="form.password" type="password" placeholder="初始密码（8 位以上，含字母和数字）" show-password-on="click" maxlength="64" />
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
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  flex-wrap: wrap;
}
.search { flex: 1; min-width: 200px; max-width: 340px; }
.sel { width: 140px; }
.sel.sm { width: 120px; }
.toolbar-right { margin-left: auto; display: flex; gap: 8px; }
.table-card { margin-top: 12px; overflow: hidden; }
.table-card :deep(.n-data-table-td) { height: 48px; }
.table-card :deep(.n-data-table__pagination) {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  margin: 0;
}
:deep(.actions-row) {
  display: flex;
  gap: 2px;
  align-items: center;
  flex-wrap: nowrap;
}
:deep(.actions-row .link-btn) {
  margin-right: 0;
  padding: 4px 6px;
  white-space: nowrap;
}
:deep(.actions-row .link-btn:disabled) {
  opacity: 0.4;
  cursor: not-allowed;
  background: transparent;
  color: var(--text-3);
}
:deep(.text-danger) { color: var(--danger) !important; }
:deep(.actions-row .text-danger:hover:not(:disabled)) { background: var(--danger-soft); }
:deep(.text-bold) { font-weight: 500; }
.sm { font-size: 13px; }
</style>
