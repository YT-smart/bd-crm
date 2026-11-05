<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue';
import {
  NForm, NFormItem, NInput, NInputNumber, NSelect,
  NDatePicker, NModal, useMessage,
} from 'naive-ui';
import { Pencil } from 'lucide-vue-next';
import { date } from '@/utils/format';
import StatusTag from '@/components/StatusTag.vue';
import OrgCard from '../OrgCard.vue';
import {
  OrgStatus, SettleCycle,
  ORG_STATUS_LABEL, SETTLE_CYCLE_LABEL,
  type OrgDetail,
} from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';

const props = withDefaults(defineProps<{ org: OrgDetail; canEdit?: boolean }>(), { canEdit: true });
const emit = defineEmits<{ updated: [] }>();
const message = useMessage();
const saving = ref(false);
const showForm = ref(false);

function openEdit() {
  resetForm();
  showForm.value = true;
}

const contractText = computed(() => {
  const a = props.org.contractStart ? date(props.org.contractStart) : '';
  const b = props.org.contractEnd ? date(props.org.contractEnd) : '';
  return a || b ? `${a || '--'} 至 ${b || '--'}` : '--';
});

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
    showForm.value = false;
    emit('updated');
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <OrgCard title="合作信息">
    <template v-if="canEdit" #extra>
      <button class="btn-outline-sm" @click="openEdit"><Pencil :size="13" :stroke-width="1.75" /> 编辑</button>
    </template>

    <div class="kv-list">
      <div class="kv-row"><span class="kv-label">合作状态</span><span class="kv-value"><StatusTag kind="org" :status="org.status" /></span></div>
      <div class="kv-row"><span class="kv-label">默认佣金</span><span class="kv-value num">{{ org.defaultRate }}%</span></div>
      <div class="kv-row"><span class="kv-label">结算周期</span><span class="kv-value">{{ org.settleCycle ? SETTLE_CYCLE_LABEL[org.settleCycle] : '--' }}</span></div>
      <div class="kv-row"><span class="kv-label">合同期限</span><span class="kv-value num">{{ contractText }}</span></div>
      <div class="kv-row"><span class="kv-label">开户银行</span><span class="kv-value">{{ org.bankInfo?.bankName || '--' }}</span></div>
      <div class="kv-row"><span class="kv-label">户名</span><span class="kv-value">{{ org.bankInfo?.accountName || '--' }}</span></div>
      <div class="kv-row"><span class="kv-label">账号</span><span class="kv-value num">{{ org.bankInfo?.accountNo || '--' }}</span></div>
      <div v-if="org.bankInfo?.note" class="kv-row"><span class="kv-label">备注</span><span class="kv-value">{{ org.bankInfo.note }}</span></div>
    </div>

    <NModal v-model:show="showForm" preset="card" title="编辑合作信息" style="max-width: 720px">
    <NForm label-placement="left" label-width="80" :show-feedback="false" :disabled="!canEdit">
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

      <h3 class="section-title gap">合同信息</h3>
      <div class="form-grid">
        <NFormItem label="合同开始">
          <NDatePicker v-model:value="form.contractStart" type="date" clearable style="width: 100%" />
        </NFormItem>
        <NFormItem label="合同到期">
          <NDatePicker v-model:value="form.contractEnd" type="date" clearable style="width: 100%" />
        </NFormItem>
      </div>

      <h3 class="section-title gap">收款账户</h3>
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
.kv-label {
  flex-basis: 72px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 14px;
}
.section-title.gap {
  margin-top: 6px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 24px;
}
</style>
