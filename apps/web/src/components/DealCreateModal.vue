<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue';
import { NDatePicker, NForm, NFormItem, NInput, NInputNumber, NModal, NSelect, useMessage } from 'naive-ui';
import { DEAL_LEAD_CATEGORIES, type DealListItem, type OrgOption } from '@bdcrm/shared';
import { dealApi, orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

/**
 * 录入成交（直接生成待到账的成交记录，管理员确认到账即结算）。
 * 管理员可以改佣金比例和金额；员工、机构按合作约定比例自动计算（后端同样强制）。
 * orgId：固定机构（机构详情页、机构账号），不传则可选择。
 * deal：传入时为编辑模式（只能改待到账的）；管理员编辑时可以更换机构。
 */
const props = defineProps<{ orgId?: string | null; deal?: DealListItem | null }>();
const show = defineModel<boolean>('show', { required: true });
const emit = defineEmits<{ created: []; saved: [] }>();
const editing = computed(() => !!props.deal);
const message = useMessage();
const auth = useAuthStore();

const lockRate = computed(() => auth.user?.role !== 'ADMIN');

const orgOptions = ref<OrgOption[]>([]);
const orgSelectOptions = computed(() => orgOptions.value.map((o) => ({ label: o.name, value: o.id })));
async function loadOrgOptions() {
  if (orgOptions.value.length) return;
  try {
    orgOptions.value = await dealApi.orgOptions();
  } catch {
    /* 选项加载失败时下拉为空 */
  }
}

/** 签约顾问：在职的员工 / 管理员账号 */
const advisorOptions = ref<{ label: string; value: string }[]>([]);
async function loadAdvisors() {
  if (advisorOptions.value.length || auth.user?.role === 'ORG') return;
  try {
    advisorOptions.value = (await orgApi.staffOptions()).map((u) => ({ label: u.name, value: u.id }));
  } catch {
    /* 加载失败时下拉为空 */
  }
}

/** 产品下拉里的「其他」：选中后手填产品名 */
const OTHER = '__other__';

const form = reactive({
  orgId: null as string | null,
  productId: null as string | null,
  customProduct: '',
  leadCategory: null as string | null,
  customCategory: '',
  advisorId: null as string | null,
  studentName: '',
  studentPhone: '',
  dealAt: Date.now() as number | null,
  amount: 0,
  rate: 15,
  commission: 0,
  note: '',
});
/** 打开编辑时回填数据，回填期间不让 watch 改掉原有比例 / 佣金 / 产品 */
let filling = false;

const selectedOrg = computed(() => orgOptions.value.find((o) => o.id === form.orgId));
const productOptions = computed(() => [
  ...(selectedOrg.value?.products.map((p) => ({ label: `${p.name}（${p.type}）`, value: p.id })) ?? []),
  { label: '其他', value: OTHER },
]);
const isOther = computed(() => form.productId === OTHER);

/** 线索分类：员工（含管理员）录入必填；机构录入的成交不需要 */
const needCategory = computed(
  () => auth.user?.role !== 'ORG' && !(editing.value && props.deal?.createdByRole === 'ORG'),
);
const categoryOptions = [...DEAL_LEAD_CATEGORIES.map((c) => ({ label: c, value: c as string })), { label: '其他', value: OTHER }];
const isOtherCategory = computed(() => form.leadCategory === OTHER);
function splitCategory(v: string | null) {
  if (!v) return { leadCategory: null, customCategory: '' };
  return (DEAL_LEAD_CATEGORIES as readonly string[]).includes(v)
    ? { leadCategory: v, customCategory: '' }
    : { leadCategory: OTHER, customCategory: v };
}

/** 约定比例：产品单独比例优先，否则机构默认比例 */
function agreedRate() {
  const org = selectedOrg.value;
  if (!org) return form.rate;
  const p = org.products.find((x) => x.id === form.productId);
  return p?.rate ?? org.defaultRate;
}

watch(() => form.orgId, () => {
  if (filling) return;
  form.productId = null;
  form.rate = agreedRate();
});
watch(() => form.productId, () => {
  if (filling) return;
  form.rate = agreedRate();
});
watch(
  () => [form.amount, form.rate],
  () => {
    if (filling) return;
    form.commission = Math.round(form.amount * form.rate) / 100;
  },
);

watch(show, async (open) => {
  if (!open) return;
  await Promise.all([loadOrgOptions(), loadAdvisors()]);
  const d = props.deal;
  if (d) {
    filling = true;
    Object.assign(form, {
      orgId: d.orgId,
      productId: d.productId ?? (d.customProduct ? OTHER : null),
      customProduct: d.customProduct ?? '',
      ...splitCategory(d.leadCategory),
      advisorId: d.advisorId,
      studentName: d.studentName,
      studentPhone: d.studentPhone ?? '',
      dealAt: new Date(d.dealAt).getTime(),
      amount: d.amount,
      rate: d.rate,
      commission: d.commission,
      note: d.note ?? '',
    });
    await nextTick();
    filling = false;
    return;
  }
  Object.assign(form, {
    orgId: props.orgId ?? (auth.user?.role === 'ORG' ? auth.user.orgId : null),
    productId: null,
    customProduct: '',
    leadCategory: null,
    customCategory: '',
    // 签约顾问默认是录入的员工自己
    advisorId: advisorOptions.value.some((o) => o.value === auth.user?.id) ? auth.user!.id : null,
    studentName: '',
    studentPhone: '',
    dealAt: Date.now(),
    amount: 0,
    note: '',
  });
  // orgId 没变时 watch 不触发，这里主动取约定比例
  form.rate = agreedRate();
});

const creating = ref(false);
async function submit() {
  if (!form.orgId) { message.warning('请选择机构'); return; }
  if (!form.productId) { message.warning('请选择产品'); return; }
  if (isOther.value && !form.customProduct.trim()) { message.warning('请填写产品名称'); return; }
  if (needCategory.value && !form.advisorId) { message.warning('请选择签约顾问'); return; }
  if (needCategory.value && !form.leadCategory) { message.warning('请选择线索分类'); return; }
  if (needCategory.value && isOtherCategory.value && !form.customCategory.trim()) { message.warning('请填写线索分类'); return; }
  if (!form.studentName.trim()) { message.warning('请输入学生姓名'); return; }
  if (!form.dealAt) { message.warning('请选择成交日期'); return; }
  if (form.amount <= 0) { message.warning('成交金额须大于0'); return; }
  creating.value = true;
  const base = {
    productId: isOther.value ? null : form.productId,
    customProduct: isOther.value ? form.customProduct.trim() : null,
    ...(needCategory.value
      ? { leadCategory: isOtherCategory.value ? form.customCategory.trim() : form.leadCategory, advisorId: form.advisorId }
      : {}),
    studentName: form.studentName.trim(),
    dealAt: new Date(form.dealAt).toISOString(),
    amount: form.amount,
    rate: form.rate,
    commission: form.commission,
    note: form.note.trim() || null,
  };
  try {
    if (props.deal) {
      await dealApi.update(props.deal.id, {
        ...base,
        studentPhone: form.studentPhone.trim() || null,
        ...(form.orgId !== props.deal.orgId ? { orgId: form.orgId } : {}),
      });
      message.success('已保存');
      show.value = false;
      emit('saved');
    } else {
      await dealApi.create({ ...base, orgId: form.orgId, studentPhone: form.studentPhone.trim() || undefined });
      message.success('成交已录入');
      show.value = false;
      emit('created');
    }
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : editing.value ? '保存失败' : '录入失败');
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <NModal v-model:show="show" preset="card" :title="editing ? '编辑成交' : '录入成交'" style="max-width: 560px">
    <NForm label-placement="left" label-width="88" :show-feedback="false">
      <NFormItem label="机构" required>
        <NSelect
          v-model:value="form.orgId"
          :options="orgSelectOptions"
          filterable
          placeholder="选择机构"
          :disabled="!!orgId || auth.user?.role === 'ORG' || (editing && auth.user?.role !== 'ADMIN')"
        />
      </NFormItem>
      <NFormItem label="产品" required>
        <NSelect
          v-model:value="form.productId"
          :options="productOptions"
          filterable
          :placeholder="form.orgId ? '选择产品，没有的选「其他」' : '先选择机构'"
          :disabled="!form.orgId"
        />
      </NFormItem>
      <NFormItem v-if="isOther" label="产品名称" required>
        <NInput v-model:value="form.customProduct" placeholder="填写产品名称" maxlength="50" />
      </NFormItem>
      <NFormItem v-if="needCategory" label="签约顾问" required>
        <NSelect v-model:value="form.advisorId" :options="advisorOptions" filterable placeholder="选择签约顾问" />
      </NFormItem>
      <NFormItem v-if="needCategory" label="线索分类" required>
        <NSelect v-model:value="form.leadCategory" :options="categoryOptions" placeholder="选择线索来源分类" />
      </NFormItem>
      <NFormItem v-if="needCategory && isOtherCategory" label="分类名称" required>
        <NInput v-model:value="form.customCategory" placeholder="填写线索分类" maxlength="30" />
      </NFormItem>
      <NFormItem label="学生姓名" required>
        <NInput v-model:value="form.studentName" placeholder="学生姓名" maxlength="50" />
      </NFormItem>
      <NFormItem label="学生电话">
        <NInput v-model:value="form.studentPhone" placeholder="手机号" maxlength="20" />
      </NFormItem>
      <NFormItem label="成交日期" required>
        <NDatePicker v-model:value="form.dealAt" type="date" style="width: 100%" />
      </NFormItem>
      <NFormItem label="成交金额" required>
        <NInputNumber v-model:value="form.amount" :min="0" :precision="0" placeholder="金额" style="width: 100%">
          <template #prefix>¥</template>
        </NInputNumber>
      </NFormItem>
      <NFormItem label="佣金比例">
        <div class="inline-field">
          <NInputNumber v-model:value="form.rate" :min="0" :max="100" :precision="1" placeholder="比例" style="width: 160px" :disabled="lockRate">
            <template #suffix>%</template>
          </NInputNumber>
          <span class="text-3 field-hint">{{ lockRate ? '按合作约定比例' : '默认取约定比例，可修改' }}</span>
        </div>
      </NFormItem>
      <NFormItem label="佣金金额">
        <div class="inline-field">
          <NInputNumber v-model:value="form.commission" :min="0" :precision="2" placeholder="佣金" style="width: 160px" :disabled="lockRate">
            <template #prefix>¥</template>
          </NInputNumber>
          <span class="text-3 field-hint">{{ lockRate ? '系统自动计算' : '按比例自动计算，可手动修改' }}</span>
        </div>
      </NFormItem>
      <NFormItem label="备注">
        <NInput v-model:value="form.note" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="年级、项目等（可选）" maxlength="500" />
      </NFormItem>
    </NForm>
    <template #action>
      <div style="display: flex; gap: 8px; justify-content: flex-end">
        <button class="btn btn-ghost" @click="show = false">取消</button>
        <button class="btn" :disabled="creating" @click="submit">{{ creating ? '提交中...' : '提交' }}</button>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.inline-field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.field-hint {
  font-size: 12px;
}
</style>
