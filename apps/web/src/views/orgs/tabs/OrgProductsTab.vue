<script setup lang="ts">
import { ref, reactive } from 'vue';
import { NModal, NForm, NFormItem, NInput, NInputNumber, NSelect, NEmpty, useMessage, useDialog } from 'naive-ui';
import { Plus, Pencil, Trash2 } from 'lucide-vue-next';
import { BUSINESS_TYPES, type OrgProductItem, type ProductInput } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { money } from '@/utils/format';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{ orgId: string; products: OrgProductItem[] }>();
const emit = defineEmits<{ refresh: [] }>();
const message = useMessage();
const dialog = useDialog();
const isOrgUser = useAuthStore().user?.role === 'ORG';

const showForm = ref(false);
const editing = ref<OrgProductItem | null>(null);
const saving = ref(false);

const typeOptions = BUSINESS_TYPES.map((t) => ({ label: t, value: t }));

const form = reactive<ProductInput>({
  name: '',
  type: BUSINESS_TYPES[0],
  priceMin: null,
  priceMax: null,
  rate: null,
  note: '',
});

function openAdd() {
  editing.value = null;
  Object.assign(form, { name: '', type: BUSINESS_TYPES[0], priceMin: null, priceMax: null, rate: null, note: '' });
  showForm.value = true;
}

function openEdit(p: OrgProductItem) {
  editing.value = p;
  Object.assign(form, {
    name: p.name,
    type: p.type,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    rate: p.rate,
    note: p.note ?? '',
  });
  showForm.value = true;
}

async function save() {
  if (!form.name.trim()) { message.warning('产品名称不能为空'); return; }
  saving.value = true;
  try {
    if (editing.value) {
      await orgApi.updateProduct(props.orgId, editing.value.id, form);
      message.success('产品已更新');
    } else {
      await orgApi.addProduct(props.orgId, form);
      message.success('产品已添加');
    }
    showForm.value = false;
    emit('refresh');
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '操作失败');
  } finally {
    saving.value = false;
  }
}

function handleDelete(p: OrgProductItem) {
  dialog.warning({
    title: '删除产品',
    content: `确定删除"${p.name}"吗？`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await orgApi.deleteProduct(props.orgId, p.id);
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
      <span class="text-2">共 {{ products.length }} 个产品</span>
      <button class="btn btn-sm" @click="openAdd"><Plus :size="14" /> 添加产品</button>
    </div>

    <NEmpty v-if="!products.length" description="暂无产品与报价" style="margin-top: 40px" />

    <div v-else class="product-grid">
      <div v-for="p in products" :key="p.id" class="product-card">
        <div class="product-top">
          <div class="product-name">{{ p.name }}</div>
          <span class="product-type">{{ p.type }}</span>
        </div>
        <div class="product-details">
          <div class="detail-row">
            <span class="text-3">报价区间</span>
            <span class="num">
              {{ p.priceMin != null || p.priceMax != null
                ? `${p.priceMin != null ? money(p.priceMin) : '--'} ~ ${p.priceMax != null ? money(p.priceMax) : '--'}`
                : '--' }}
            </span>
          </div>
          <div class="detail-row">
            <span class="text-3">佣金比例</span>
            <span class="num">{{ p.rate != null ? `${p.rate}%` : '使用默认' }}</span>
          </div>
        </div>
        <div v-if="p.note" class="product-note text-3">{{ p.note }}</div>
        <div class="product-actions">
          <button class="icon-btn" title="编辑" @click="openEdit(p)"><Pencil :size="14" /></button>
          <button class="icon-btn danger" title="删除" @click="handleDelete(p)"><Trash2 :size="14" /></button>
        </div>
      </div>
    </div>

    <NModal v-model:show="showForm" preset="card" :title="editing ? '编辑产品' : '添加产品'" style="max-width: 520px">
      <NForm label-placement="left" label-width="80" :show-feedback="false">
        <NFormItem label="产品名称" required>
          <NInput v-model:value="form.name" placeholder="产品名称" maxlength="100" />
        </NFormItem>
        <NFormItem label="业务类型" required>
          <NSelect v-model:value="form.type" :options="typeOptions" />
        </NFormItem>
        <div style="display: flex; gap: 16px">
          <NFormItem label="最低报价" style="flex: 1">
            <NInputNumber v-model:value="form.priceMin" :min="0" :precision="0" placeholder="最低价" style="width: 100%" />
          </NFormItem>
          <NFormItem label="最高报价" style="flex: 1">
            <NInputNumber v-model:value="form.priceMax" :min="0" :precision="0" placeholder="最高价" style="width: 100%" />
          </NFormItem>
        </div>
        <NFormItem v-if="!isOrgUser" label="佣金比例">
          <NInputNumber v-model:value="form.rate" :min="0" :max="100" :precision="1" placeholder="空则使用默认" style="width: 160px">
            <template #suffix>%</template>
          </NInputNumber>
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="form.note" type="textarea" placeholder="备注说明" :autosize="{ minRows: 2, maxRows: 4 }" maxlength="500" />
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
.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.product-card {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  position: relative;
}
.product-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.product-name {
  font-weight: 600;
  font-size: 15px;
}
.product-type {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 99px;
  background: var(--brand-soft);
  color: var(--brand);
}
.product-details {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.product-note {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
}
.product-actions {
  position: absolute;
  top: 12px;
  right: -4px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.product-card:hover .product-actions {
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
.icon-btn:hover { background: var(--neutral-soft); }
.icon-btn.danger:hover { background: var(--danger-soft); color: var(--danger); }
</style>
