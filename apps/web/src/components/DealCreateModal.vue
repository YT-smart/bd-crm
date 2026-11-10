<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NDatePicker, NForm, NFormItem, NInput, NInputNumber, NModal, NSelect, useMessage } from 'naive-ui';
import type { OrgOption } from '@bdcrm/shared';
import { dealApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

/**
 * 录入成交（直接生成待到账的成交记录，管理员确认到账即结算）。
 * 管理员可以改佣金比例和金额；员工、机构按合作约定比例自动计算（后端同样强制）。
 * orgId：固定机构（机构详情页、机构账号），不传则可选择。
 */
const props = defineProps<{ orgId?: string | null }>();
const show = defineModel<boolean>('show', { required: true });
const emit = defineEmits<{ created: [] }>();
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

const form = reactive({
  orgId: null as string | null,
  productId: null as string | null,
  studentName: '',
  studentPhone: '',
  dealAt: Date.now() as number | null,
  amount: 0,
  rate: 15,
  commission: 0,
});

const selectedOrg = computed(() => orgOptions.value.find((o) => o.id === form.orgId));
const productOptions = computed(
  () => selectedOrg.value?.products.map((p) => ({ label: `${p.name}（${p.type}）`, value: p.id })) ?? [],
);

/** 约定比例：产品单独比例优先，否则机构默认比例 */
function agreedRate() {
  const org = selectedOrg.value;
  if (!org) return form.rate;
  const p = org.products.find((x) => x.id === form.productId);
  return p?.rate ?? org.defaultRate;
}

watch(() => form.orgId, () => {
  form.productId = null;
  form.rate = agreedRate();
});
watch(() => form.productId, () => {
  form.rate = agreedRate();
});
watch(
  () => [form.amount, form.rate],
  () => {
    form.commission = Math.round(form.amount * form.rate) / 100;
  },
);

watch(show, async (open) => {
  if (!open) return;
  await loadOrgOptions();
  Object.assign(form, {
    orgId: props.orgId ?? (auth.user?.role === 'ORG' ? auth.user.orgId : null),
    productId: null,
    studentName: '',
    studentPhone: '',
    dealAt: Date.now(),
    amount: 0,
  });
  // orgId 没变时 watch 不触发，这里主动取约定比例
  form.rate = agreedRate();
});

const creating = ref(false);
async function submit() {
  if (!form.orgId) { message.warning('请选择机构'); return; }
  if (!form.studentName.trim()) { message.warning('请输入学生姓名'); return; }
  if (!form.dealAt) { message.warning('请选择成交日期'); return; }
  if (form.amount <= 0) { message.warning('成交金额须大于0'); return; }
  creating.value = true;
  try {
    await dealApi.create({
      orgId: form.orgId,
      productId: form.productId,
      studentName: form.studentName.trim(),
      studentPhone: form.studentPhone.trim() || undefined,
      dealAt: new Date(form.dealAt).toISOString(),
      amount: form.amount,
      rate: form.rate,
      commission: form.commission,
    });
    message.success('成交已录入');
    show.value = false;
    emit('created');
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '录入失败');
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <NModal v-model:show="show" preset="card" title="录入成交" style="max-width: 560px">
    <NForm label-placement="left" label-width="80" :show-feedback="false">
      <NFormItem label="机构" required>
        <NSelect
          v-model:value="form.orgId"
          :options="orgSelectOptions"
          filterable
          placeholder="选择机构"
          :disabled="!!orgId || auth.user?.role === 'ORG'"
        />
      </NFormItem>
      <NFormItem v-if="productOptions.length" label="产品">
        <NSelect v-model:value="form.productId" :options="productOptions" clearable placeholder="选择产品（可选）" />
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
