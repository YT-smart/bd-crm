<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  NDrawer, NDrawerContent, NInput, NSelect, NModal, NForm, NFormItem,
  NInputNumber, NDatePicker, NSpin, useMessage,
} from 'naive-ui';
import { Pencil, FileSignature, MessageSquarePlus } from 'lucide-vue-next';
import { LEAD_FOLLOW_METHODS, type LeadDetail, type OrgOption } from '@bdcrm/shared';
import { dealApi, leadApi } from '@/api';
import { ApiError } from '@/api/http';
import { date, dateTime } from '@/utils/format';
import { pushPill } from './leadStyle';

const props = defineProps<{ leadId: string | null; canSign: boolean }>();
const show = defineModel<boolean>('show', { required: true });
const emit = defineEmits<{ edit: [lead: LeadDetail]; changed: [] }>();
const message = useMessage();
const router = useRouter();

const lead = ref<LeadDetail | null>(null);
const loading = ref(false);

async function load() {
  if (!props.leadId) return;
  loading.value = true;
  try {
    lead.value = await leadApi.detail(props.leadId);
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '加载失败');
  } finally {
    loading.value = false;
  }
}
watch(() => [show.value, props.leadId], () => { if (show.value) load(); }, { immediate: true });
defineExpose({ reload: load });

/* ---------- 跟进记录 ---------- */
const follow = reactive({ method: '电话', content: '' });
const posting = ref(false);
async function addFollow() {
  if (!lead.value || !follow.content.trim()) return;
  posting.value = true;
  try {
    await leadApi.addFollow(lead.value.id, follow.method, follow.content.trim());
    follow.content = '';
    message.success('已记录跟进');
    await load();
    emit('changed');
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '保存失败');
  } finally {
    posting.value = false;
  }
}

/* ---------- 登记签约 → 生成待审核成交 ---------- */
const showSign = ref(false);
const orgOptions = ref<OrgOption[]>([]);
const sign = reactive({
  orgId: null as string | null,
  productId: null as string | null,
  dealAt: Date.now() as number | null,
  amount: 0,
  rate: 0,
  commission: 0,
  note: '',
});
const signOrg = computed(() => orgOptions.value.find((o) => o.id === sign.orgId));
const productOptions = computed(() => signOrg.value?.products.map((p) => ({ label: `${p.name}（${p.type}）`, value: p.id })) ?? []);

watch(() => sign.orgId, () => {
  sign.productId = null;
  if (signOrg.value) sign.rate = signOrg.value.defaultRate;
});
watch(() => sign.productId, (pid) => {
  const p = signOrg.value?.products.find((x) => x.id === pid);
  if (p?.rate != null) sign.rate = p.rate;
});
watch(() => [sign.amount, sign.rate], () => { sign.commission = Math.round(sign.amount * sign.rate) / 100; });

async function openSign() {
  if (!lead.value) return;
  if (!orgOptions.value.length) {
    try { orgOptions.value = await dealApi.orgOptions(); } catch {}
  }
  Object.assign(sign, { orgId: lead.value.orgId, productId: null, dealAt: Date.now(), amount: 0, note: '' });
  if (signOrg.value) sign.rate = signOrg.value.defaultRate;
  showSign.value = true;
}

const signing = ref(false);
async function submitSign() {
  if (!lead.value) return;
  if (!sign.orgId) { message.warning('请选择签约机构'); return; }
  if (!sign.dealAt) { message.warning('请选择成交日期'); return; }
  if (sign.amount <= 0) { message.warning('成交金额须大于 0'); return; }
  signing.value = true;
  try {
    await leadApi.sign(lead.value.id, {
      orgId: sign.orgId,
      productId: sign.productId,
      dealAt: new Date(sign.dealAt).toISOString(),
      amount: sign.amount,
      rate: sign.rate,
      commission: sign.commission,
      note: sign.note.trim() || null,
    });
    message.success('签约已登记，已生成待审核的成交记录');
    showSign.value = false;
    await load();
    emit('changed');
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '登记失败');
  } finally {
    signing.value = false;
  }
}

const join = (arr: string[]) => (arr.length ? arr.join('、') : '--');
</script>

<template>
  <NDrawer v-model:show="show" :width="520" placement="right" style="max-width: 100vw">
    <NDrawerContent :title="lead?.studentName ?? '线索详情'" closable :native-scrollbar="false">
      <NSpin :show="loading && !lead">
        <template v-if="lead">
          <div class="head">
            <span :class="['pill', pushPill(lead.pushStatus)]">{{ lead.pushStatus }}</span>
            <span v-if="lead.intention" class="pill pill-neutral plain">{{ lead.intention }}</span>
            <div class="head-actions">
              <button class="btn btn-ghost btn-sm" @click="emit('edit', lead)"><Pencil :size="14" /> 编辑</button>
              <button v-if="canSign && !lead.dealId" id="lead-sign" class="btn btn-sm" @click="openSign">
                <FileSignature :size="14" /> 登记签约
              </button>
            </div>
          </div>

          <dl class="kv">
            <dt>手机号</dt><dd class="num">{{ lead.phone ?? '--' }}</dd>
            <dt>微信号</dt><dd>{{ lead.wechat ?? '--' }}<span v-if="lead.wechatStatus" class="text-3">（{{ lead.wechatStatus }}）</span></dd>
            <dt>来源</dt><dd>{{ lead.source ?? '--' }}</dd>
            <dt>产品标签</dt><dd>{{ join(lead.productTags) }}</dd>
            <dt>就读年级</dt><dd>{{ lead.grade ?? '--' }}</dd>
            <dt>申请学历</dt><dd>{{ lead.degree ?? '--' }}</dd>
            <dt>留学地区</dt><dd>{{ join(lead.regions) }}</dd>
            <dt>跟进机构</dt>
            <dd>
              <a v-if="lead.orgId" class="link" @click="router.push(`/orgs/${lead.orgId}`)">{{ lead.orgName }}</a>
              <template v-else>--</template>
              <span v-if="lead.pushedAt" class="text-3">（{{ date(lead.pushedAt) }} 推出）</span>
            </dd>
            <dt>跟进人</dt><dd>{{ lead.assigneeName ?? '未分配' }}<span v-if="lead.assignedAt" class="text-3">（{{ date(lead.assignedAt) }} 分配）</span></dd>
            <dt>创建人</dt><dd>{{ lead.createdByName }}<span class="text-3">（{{ dateTime(lead.createdAt) }}）</span></dd>
            <dt>成交</dt>
            <dd>
              <a v-if="lead.dealId" class="link" @click="router.push('/deals')">已生成成交记录</a>
              <template v-else>--</template>
            </dd>
            <dt>备注</dt><dd class="pre">{{ lead.note ?? '--' }}</dd>
          </dl>

          <div class="section-title">跟进记录（{{ lead.follows.length }}）</div>
          <div class="composer">
            <div class="methods">
              <button
                v-for="m in LEAD_FOLLOW_METHODS" :key="m" type="button"
                :class="['m', { on: follow.method === m }]" @click="follow.method = m"
              >{{ m }}</button>
            </div>
            <NInput
              id="follow-input"
              v-model:value="follow.content" type="textarea" maxlength="1000"
              :autosize="{ minRows: 2, maxRows: 5 }" placeholder="这次沟通了什么、下一步怎么跟"
            />
            <div class="composer-actions">
              <button id="follow-submit" class="btn btn-sm" :disabled="posting || !follow.content.trim()" @click="addFollow">
                <MessageSquarePlus :size="14" /> 记录跟进
              </button>
            </div>
          </div>
          <ul class="timeline">
            <li v-for="f in lead.follows" :key="f.id">
              <div class="t-head">
                <span class="pill pill-brand plain">{{ f.method }}</span>
                <span class="t-user">{{ f.userName }}</span>
                <span class="t-time num text-3">{{ dateTime(f.createdAt) }}</span>
              </div>
              <div class="t-content">{{ f.content }}</div>
            </li>
            <li v-if="!lead.follows.length" class="empty text-3">还没有跟进记录</li>
          </ul>
        </template>
      </NSpin>
    </NDrawerContent>
  </NDrawer>

  <NModal v-model:show="showSign" preset="card" title="登记签约" style="max-width: 540px">
    <p class="text-3 sign-tip">登记后会生成一条「待审核」的成交记录，线索状态改为已签约。</p>
    <NForm label-placement="left" label-width="92" :show-feedback="false" class="sign-form">
      <NFormItem label="签约机构" required>
        <NSelect v-model:value="sign.orgId" :options="orgOptions.map((o) => ({ label: o.name, value: o.id }))" filterable placeholder="选择机构" />
      </NFormItem>
      <NFormItem v-if="productOptions.length" label="产品">
        <NSelect v-model:value="sign.productId" :options="productOptions" clearable placeholder="选择产品（可选）" />
      </NFormItem>
      <NFormItem label="成交日期" required>
        <NDatePicker v-model:value="sign.dealAt" type="date" style="width: 100%" />
      </NFormItem>
      <NFormItem label="成交金额" required>
        <NInputNumber id="sign-amount" v-model:value="sign.amount" :min="0" :precision="0" style="width: 100%">
          <template #prefix>¥</template>
        </NInputNumber>
      </NFormItem>
      <NFormItem label="佣金比例">
        <NInputNumber v-model:value="sign.rate" :min="0" :max="100" :precision="1" style="width: 160px">
          <template #suffix>%</template>
        </NInputNumber>
      </NFormItem>
      <NFormItem label="佣金金额">
        <NInputNumber v-model:value="sign.commission" :min="0" :precision="2" style="width: 160px">
          <template #prefix>¥</template>
        </NInputNumber>
      </NFormItem>
      <NFormItem label="备注">
        <NInput v-model:value="sign.note" maxlength="500" placeholder="可选" />
      </NFormItem>
    </NForm>
    <template #action>
      <div style="display: flex; gap: 8px; justify-content: flex-end">
        <button class="btn btn-ghost" @click="showSign = false">取消</button>
        <button id="sign-submit" class="btn" :disabled="signing" @click="submitSign">{{ signing ? '提交中...' : '确认签约' }}</button>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.head-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
.kv {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 9px 12px;
  margin: 0;
  font-size: 13px;
}
.kv dt {
  color: var(--text-3);
}
.kv dd {
  margin: 0;
  color: var(--text);
  word-break: break-word;
}
.pre {
  white-space: pre-wrap;
}
.link {
  color: var(--brand);
  cursor: pointer;
}
.link:hover {
  text-decoration: underline;
}
.section-title {
  margin: 22px 0 10px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  font-size: 14px;
  font-weight: 600;
}
.methods {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.m {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
}
.m.on {
  border-color: var(--brand);
  color: var(--brand);
  background: var(--brand-soft);
}
.composer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
.timeline {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}
.timeline li {
  padding: 10px 0;
  border-top: 1px solid var(--border);
}
.t-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.t-user {
  font-weight: 600;
}
.t-time {
  margin-left: auto;
}
.t-content {
  margin-top: 5px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-2);
  white-space: pre-wrap;
}
.empty {
  text-align: center;
  font-size: 13px;
}
.sign-tip {
  margin: 0 0 14px;
  font-size: 13px;
}
.sign-form :deep(.n-form-item) {
  margin-bottom: 12px;
}
</style>
