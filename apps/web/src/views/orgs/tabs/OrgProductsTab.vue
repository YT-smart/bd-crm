<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { NModal, NForm, NFormItem, NInput, NInputNumber, NSelect, useMessage, useDialog } from 'naive-ui';
import { Plus } from 'lucide-vue-next';
import OrgCard from '../OrgCard.vue';
import { BUSINESS_TYPES, BUSINESS_TYPE_MAX_LEN, PRODUCT_LEVELS, PRODUCT_LEVEL_LABEL, type OrgProductItem, type ProductInput } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { money } from '@/utils/format';

const props = withDefaults(
  defineProps<{ orgId: string; products: OrgProductItem[]; defaultRate: number; canEdit?: boolean; showRate?: boolean }>(),
  { canEdit: true, showRate: true },
);
const emit = defineEmits<{ refresh: [] }>();
const message = useMessage();

function priceText(p: OrgProductItem) {
  if (p.priceMin == null && p.priceMax == null) return '--';
  if (p.priceMin != null && p.priceMin === p.priceMax) return money(p.priceMin);
  return `${p.priceMin != null ? money(p.priceMin) : '--'} ~ ${p.priceMax != null ? money(p.priceMax) : '--'}`;
}
const dialog = useDialog();

const showForm = ref(false);
const editing = ref<OrgProductItem | null>(null);
const saving = ref(false);

/** 选「其他」时显示输入框，填写自定义类型 */
const OTHER = '__other__';
const customType = ref('');
/** 常用类型 + 本机构已用过的自定义类型 + 其他（自定义） */
const typeOptions = computed(() => [
  ...[...new Set([...BUSINESS_TYPES, ...props.products.map((p) => p.type), form.type].filter((t) => t && t !== OTHER))].map((t) => ({
    label: t,
    value: t,
  })),
  { label: '其他（自定义）', value: OTHER },
]);
const levelOptions = PRODUCT_LEVELS.map((l) => ({ label: PRODUCT_LEVEL_LABEL[l], value: l }));

const form = reactive<ProductInput>({
  name: '',
  type: BUSINESS_TYPES[0],
  priceMin: null,
  priceMax: null,
  rate: null,
  level: null,
  note: '',
});

function openAdd() {
  editing.value = null;
  Object.assign(form, { name: '', type: BUSINESS_TYPES[0], priceMin: null, priceMax: null, rate: null, level: null, note: '' });
  customType.value = '';
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
    level: p.level,
    note: p.note ?? '',
  });
  customType.value = '';
  showForm.value = true;
}

async function save() {
  if (!form.name.trim()) { message.warning('产品名称不能为空'); return; }
  const type = (form.type === OTHER ? customType.value : form.type ?? '').trim();
  if (!type) { message.warning(form.type === OTHER ? '请填写自定义的业务类型' : '请选择业务类型'); return; }
  if (type.length > BUSINESS_TYPE_MAX_LEN) { message.warning(`业务类型请控制在 ${BUSINESS_TYPE_MAX_LEN} 字以内`); return; }
  const payload = { ...form, type };
  saving.value = true;
  try {
    if (editing.value) {
      await orgApi.updateProduct(props.orgId, editing.value.id, payload);
      message.success('产品已更新');
    } else {
      await orgApi.addProduct(props.orgId, payload);
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
  <OrgCard title="产品与报价">
    <template v-if="canEdit" #extra>
      <button id="product-add" class="btn-outline-sm" @click="openAdd"><Plus :size="13" /> 添加产品</button>
    </template>

    <div v-if="!products.length" class="empty text-3">暂未添加产品与报价</div>

    <div v-else class="table-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th>推荐</th>
            <th>产品名称</th>
            <th>类型</th>
            <th>报价</th>
            <th v-if="showRate">佣金</th>
            <th>说明</th>
            <th v-if="canEdit" class="op">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.id">
            <td class="nowrap">
              <span v-if="p.level" :class="['plevel', `plevel-${p.level}`]" :title="PRODUCT_LEVEL_LABEL[p.level]">
                {{ p.level === 1 ? '主推' : `${p.level} 级` }}
              </span>
              <span v-else class="text-3">-</span>
            </td>
            <td class="strong">{{ p.name }}</td>
            <td class="nowrap">{{ p.type }}</td>
            <td class="num nowrap">{{ priceText(p) }}</td>
            <td v-if="showRate" class="num nowrap">
              <span :class="{ rate: p.rate != null }">{{ p.rate ?? defaultRate }}%</span>
            </td>
            <td class="note">{{ p.note || '-' }}</td>
            <td v-if="canEdit" class="op">
              <button class="link-op" @click="openEdit(p)">编辑</button>
              <button class="link-op danger" @click="handleDelete(p)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <NModal v-model:show="showForm" preset="card" :title="editing ? '编辑产品' : '添加产品'" style="max-width: 520px">
      <NForm label-placement="left" label-width="96" :show-feedback="false">
        <NFormItem label="产品名称" required>
          <NInput v-model:value="form.name" placeholder="产品名称" maxlength="100" />
        </NFormItem>
        <NFormItem label="业务类型" required>
          <NSelect
            id="product-type"
            v-model:value="form.type"
            :options="typeOptions"
            placeholder="选择业务类型"
          />
        </NFormItem>
        <NFormItem v-if="form.type === OTHER" label="自定义类型" required>
          <NInput
            id="product-custom-type"
            v-model:value="customType"
            :maxlength="BUSINESS_TYPE_MAX_LEN"
            placeholder="填写业务类型，如：夏令营、艺术留学"
          />
        </NFormItem>
        <NFormItem label="推荐级别">
          <NSelect
            id="product-level"
            v-model:value="form.level"
            :options="levelOptions"
            clearable
            placeholder="1 级为主推，产品按级别排序"
            style="width: 240px"
          />
        </NFormItem>
        <div style="display: flex; gap: 16px">
          <NFormItem label="最低报价" style="flex: 1">
            <NInputNumber v-model:value="form.priceMin" :min="0" :precision="0" placeholder="最低价" style="width: 100%" />
          </NFormItem>
          <NFormItem label="最高报价" style="flex: 1">
            <NInputNumber v-model:value="form.priceMax" :min="0" :precision="0" placeholder="最高价" style="width: 100%" />
          </NFormItem>
        </div>
        <NFormItem v-if="showRate" label="佣金比例">
          <NInputNumber
            id="product-rate"
            v-model:value="form.rate"
            :min="0"
            :max="100"
            :precision="1"
            :placeholder="`留空则按默认 ${defaultRate}%`"
            style="width: 200px"
          >
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
  </OrgCard>
</template>

<style scoped>
.empty {
  font-size: 13px;
  padding: 18px 0;
  text-align: center;
}
.table-wrap {
  overflow-x: auto;
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.tbl th {
  text-align: left;
  font-weight: 400;
  font-size: 13px;
  color: var(--text-3);
  background: var(--bg-subtle, var(--neutral-soft));
  padding: 12px 16px;
  white-space: nowrap;
}
.tbl td {
  padding: 14px 16px;
  border-top: 1px solid var(--border);
  color: var(--text);
  vertical-align: top;
}
.tbl tr:hover td { background: var(--bg-subtle, var(--neutral-soft)); }
.strong { font-weight: 500; white-space: nowrap; }
.nowrap { white-space: nowrap; }
.note { color: var(--text-2); min-width: 140px; }
.rate { color: var(--brand); font-weight: 600; }
.plevel {
  display: inline-block;
  font-size: 12px;
  line-height: 20px;
  padding: 0 7px;
  border-radius: 5px;
  background: var(--neutral-soft);
  color: var(--text-2);
}
.plevel-1 { background: var(--danger-soft, #fde8e8); color: var(--danger); font-weight: 600; }
.plevel-2 { background: var(--warning-soft, #fff3e0); color: var(--warning); }
.plevel-3 { background: var(--info-soft); color: var(--info); }
.op { width: 100px; white-space: nowrap; text-align: right; }
.link-op {
  padding: 0;
  margin-left: 12px;
  border: 0;
  background: none;
  color: var(--brand);
  font-size: 13px;
  cursor: pointer;
}
.link-op:hover { text-decoration: underline; }
.link-op.danger { color: var(--danger); }
</style>
