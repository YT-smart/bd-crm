<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import {
  NForm, NFormItem, NInput, NInputNumber, NSelect,
  NDatePicker, useMessage,
} from 'naive-ui';
import { Save } from 'lucide-vue-next';
import {
  OrgStatus, SettleCycle,
  ORG_STATUS_LABEL, SETTLE_CYCLE_LABEL,
  type OrgDetail,
} from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{ org: OrgDetail }>();
const emit = defineEmits<{ updated: [] }>();
const message = useMessage();
const auth = useAuthStore();
const saving = ref(false);

const statusOptions = (Object.keys(ORG_STATUS_LABEL) as OrgStatus[]).map((k) => ({
  label: ORG_STATUS_LABEL[k],
  value: k,
}));
const cycleOptions = (Object.keys(SETTLE_CYCLE_LABEL) as SettleCycle[]).map((k) => ({
  label: SETTLE_CYCLE_LABEL[k],
  value: k,
}));

const form = reactive({
  status: 'NEGOTIATING' as OrgStatus,
  defaultRate: 0,
  settleCycle: null as SettleCycle | null,
  contractStart: null as number | null,
  contractEnd: null as number | null,
  bankName: '',
  accountName: '',
  accountNo: '',
  bankNote: '',
});

function resetForm() {
  form.status = props.org.status;
  form.defaultRate = props.org.defaultRate;
  form.settleCycle = props.org.settleCycle;
  form.contractStart = props.org.contractStart ? new Date(props.org.contractStart).getTime() : null;
  form.contractEnd = props.org.contractEnd ? new Date(props.org.contractEnd).getTime() : null;
  form.bankName = props.org.bankInfo?.bankName ?? '';
  form.accountName = props.org.bankInfo?.accountName ?? '';
  form.accountNo = props.org.bankInfo?.accountNo ?? '';
  form.bankNote = props.org.bankInfo?.note ?? '';
}

watch(() => props.org, resetForm, { immediate: true });

async function save() {
  saving.value = true;
  try {
    await orgApi.update(props.org.id, {
      status: form.status,
      defaultRate: form.defaultRate,
      settleCycle: form.settleCycle,
      contractStart: form.contractStart ? new Date(form.contractStart).toISOString() : null,
      contractEnd: form.contractEnd ? new Date(form.contractEnd).toISOString() : null,
      bankInfo: (form.bankName || form.accountName || form.accountNo)
        ? { bankName: form.bankName, accountName: form.accountName, accountNo: form.accountNo, note: form.bankNote }
        : null,
    });
    message.success('已保存');
    emit('updated');
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="coop-tab">
    <NForm label-placement="left" label-width="100" :show-feedback="false">
      <h3 class="section-title">合作状态</h3>
      <div class="form-grid">
        <NFormItem label="合作状态">
          <NSelect v-model:value="form.status" :options="statusOptions" />
        </NFormItem>
        <NFormItem label="默认佣金">
          <NInputNumber v-model:value="form.defaultRate" :min="0" :max="100" :precision="1" style="width: 160px">
            <template #suffix>%</template>
          </NInputNumber>
        </NFormItem>
        <NFormItem label="结算周期">
          <NSelect v-model:value="form.settleCycle" :options="cycleOptions" clearable placeholder="选择结算周期" />
        </NFormItem>
      </div>

      <h3 class="section-title" style="margin-top: 24px">合同信息</h3>
      <div class="form-grid">
        <NFormItem label="合同开始">
          <NDatePicker v-model:value="form.contractStart" type="date" clearable style="width: 100%" />
        </NFormItem>
        <NFormItem label="合同到期">
          <NDatePicker v-model:value="form.contractEnd" type="date" clearable style="width: 100%" />
        </NFormItem>
      </div>

      <h3 class="section-title" style="margin-top: 24px">收款账户</h3>
      <div class="form-grid">
        <NFormItem label="开户银行">
          <NInput v-model:value="form.bankName" placeholder="开户银行" maxlength="100" />
        </NFormItem>
        <NFormItem label="户名">
          <NInput v-model:value="form.accountName" placeholder="账户名称" maxlength="100" />
        </NFormItem>
        <NFormItem label="账号">
          <NInput v-model:value="form.accountNo" placeholder="银行账号" maxlength="50" />
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="form.bankNote" placeholder="备注" maxlength="200" />
        </NFormItem>
      </div>
    </NForm>

    <div class="actions">
      <button class="btn" :disabled="saving" @click="save">
        <Save :size="14" /> {{ saving ? '保存中...' : '保存' }}
      </button>
      <button class="btn btn-ghost" @click="resetForm">重置</button>
    </div>
  </div>
</template>

<style scoped>
.coop-tab {
  max-width: 800px;
}
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 24px;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
</style>
