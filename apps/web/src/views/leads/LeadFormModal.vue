<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { NModal, NForm, NFormItem, NInput, NSelect, useMessage } from 'naive-ui';
import {
  LEAD_DEGREES, LEAD_GRADES, LEAD_INTENTIONS, LEAD_PRODUCT_TAGS, LEAD_PUSH_STATUS,
  LEAD_REGIONS, LEAD_SOURCES, LEAD_WECHAT_STATUS,
  type LeadInput, type LeadListItem, type StaffOption,
} from '@bdcrm/shared';
import { leadApi } from '@/api';
import { ApiError } from '@/api/http';
import OrgPicker from './OrgPicker.vue';

const props = defineProps<{
  /** 编辑时传入；新增时为 null */
  lead: LeadListItem | null;
  /** 管理员可以指定跟进人 */
  canAssign: boolean;
  staff: StaffOption[];
}>();
const show = defineModel<boolean>('show', { required: true });
const emit = defineEmits<{ saved: [id: string] }>();
const message = useMessage();

const opts = (arr: readonly string[]) => arr.map((v) => ({ label: v, value: v }));

const blank = () => ({
  studentName: '',
  phone: '',
  wechat: '',
  source: null as string | null,
  productTags: [] as string[],
  grade: null as string | null,
  degree: null as string | null,
  regions: [] as string[],
  wechatStatus: null as string | null,
  intention: null as string | null,
  pushStatus: '未推出' as string,
  orgId: null as string | null,
  assigneeId: null as string | null,
  note: '',
});
const form = reactive(blank());
const orgLabel = ref<string | null>(null);

watch(show, (v) => {
  if (!v) return;
  const l = props.lead;
  Object.assign(
    form,
    l
      ? {
          studentName: l.studentName, phone: l.phone ?? '', wechat: l.wechat ?? '', source: l.source,
          productTags: [...l.productTags], grade: l.grade, degree: l.degree, regions: [...l.regions],
          wechatStatus: l.wechatStatus, intention: l.intention, pushStatus: l.pushStatus,
          orgId: l.orgId, assigneeId: l.assigneeId, note: l.note ?? '',
        }
      : blank(),
  );
  orgLabel.value = l?.orgName ?? null;
});

// 选了跟进机构、状态还是「未推出」时自动改成「已推出」
watch(() => form.orgId, (id, old) => {
  if (id && !old && form.pushStatus === '未推出') form.pushStatus = '已推出';
});

const staffOptions = computed(() => props.staff.map((s) => ({ label: s.name, value: s.id })));
// 已签约必须走「登记签约」生成成交，这里不让手动选
const statusOptions = computed(() =>
  LEAD_PUSH_STATUS.map((v) => ({ label: v, value: v, disabled: v === '已签约' && props.lead?.pushStatus !== '已签约' })),
);

const saving = ref(false);
async function submit() {
  if (!form.studentName.trim()) {
    message.warning('请填写学生姓名');
    return;
  }
  const data: LeadInput = {
    studentName: form.studentName.trim(),
    phone: form.phone.trim() || null,
    wechat: form.wechat.trim() || null,
    source: form.source,
    productTags: form.productTags,
    grade: form.grade,
    degree: form.degree,
    regions: form.regions,
    wechatStatus: form.wechatStatus,
    intention: form.intention,
    pushStatus: form.pushStatus,
    orgId: form.orgId,
    note: form.note.trim() || null,
  };
  if (props.canAssign) data.assigneeId = form.assigneeId;
  saving.value = true;
  try {
    const r = props.lead ? await leadApi.update(props.lead.id, data) : await leadApi.create(data);
    message.success(props.lead ? '已保存' : '线索已录入');
    show.value = false;
    emit('saved', r.id);
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <NModal v-model:show="show" preset="card" :title="lead ? '编辑线索' : '新增线索'" style="max-width: 720px">
    <NForm label-placement="left" label-width="84" :show-feedback="false" class="lead-form">
      <div class="grid">
        <NFormItem label="学生姓名" required>
          <NInput id="lead-name" v-model:value="form.studentName" maxlength="50" placeholder="学生姓名" />
        </NFormItem>
        <NFormItem label="来源">
          <NSelect v-model:value="form.source" :options="opts(LEAD_SOURCES)" clearable filterable tag placeholder="选择或输入来源" />
        </NFormItem>
        <NFormItem label="手机号">
          <NInput v-model:value="form.phone" maxlength="30" placeholder="手机号" />
        </NFormItem>
        <NFormItem label="微信号">
          <NInput v-model:value="form.wechat" maxlength="50" placeholder="微信号" />
        </NFormItem>
        <NFormItem label="就读年级">
          <NSelect v-model:value="form.grade" :options="opts(LEAD_GRADES)" clearable placeholder="就读年级" />
        </NFormItem>
        <NFormItem label="申请学历">
          <NSelect v-model:value="form.degree" :options="opts(LEAD_DEGREES)" clearable placeholder="申请学历" />
        </NFormItem>
        <NFormItem label="产品标签" class="span-2">
          <NSelect v-model:value="form.productTags" :options="opts(LEAD_PRODUCT_TAGS)" multiple filterable tag placeholder="意向产品，可多选，也可输入新标签" />
        </NFormItem>
        <NFormItem label="留学地区" class="span-2">
          <NSelect v-model:value="form.regions" :options="opts(LEAD_REGIONS)" multiple clearable placeholder="可多选" />
        </NFormItem>
        <NFormItem label="添加微信">
          <NSelect v-model:value="form.wechatStatus" :options="opts(LEAD_WECHAT_STATUS)" clearable placeholder="添加微信" />
        </NFormItem>
        <NFormItem label="意向度">
          <NSelect v-model:value="form.intention" :options="opts(LEAD_INTENTIONS)" clearable placeholder="意向度" />
        </NFormItem>
        <NFormItem label="跟进机构">
          <OrgPicker v-model:value="form.orgId" :label="orgLabel" :disabled="!!lead?.dealId" />
        </NFormItem>
        <NFormItem label="推出状态">
          <NSelect v-model:value="form.pushStatus" :options="statusOptions" :disabled="!!lead?.dealId" />
        </NFormItem>
        <NFormItem v-if="canAssign" label="跟进人">
          <NSelect v-model:value="form.assigneeId" :options="staffOptions" clearable filterable placeholder="分配给谁跟进" />
        </NFormItem>
        <NFormItem label="备注" class="span-2">
          <NInput v-model:value="form.note" type="textarea" maxlength="1000" :autosize="{ minRows: 2, maxRows: 5 }" placeholder="学生情况、需求、预算等" />
        </NFormItem>
      </div>
      <p v-if="!canAssign && !lead" class="hint text-3">你录入的线索默认由你自己跟进。</p>
    </NForm>
    <template #action>
      <div style="display: flex; gap: 8px; justify-content: flex-end">
        <button class="btn btn-ghost" @click="show = false">取消</button>
        <button id="lead-save" class="btn" :disabled="saving" @click="submit">{{ saving ? '保存中...' : '保存' }}</button>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}
.span-2 {
  grid-column: span 2;
}
.hint {
  margin: 12px 0 0;
  font-size: 12px;
}
@media (max-width: 640px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .span-2 {
    grid-column: auto;
  }
}
</style>
