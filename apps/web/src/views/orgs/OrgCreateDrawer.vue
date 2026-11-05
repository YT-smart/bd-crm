<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import {
  NDrawer, NDrawerContent, NForm, NFormItem, NModal,
  NInput, NInputNumber, NSelect, NSwitch, NRadioGroup, NRadio, useMessage,
} from 'naive-ui';
import { Check, Copy, Info, KeyRound, ShieldCheck } from 'lucide-vue-next';
import {
  PROVINCES, CITIES_BY_PROVINCE, PROVINCE_OF_CITY, shortProvinceName,
  type OrgCreateResult, type Province,
} from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';

defineProps<{ show: boolean }>();
const emit = defineEmits<{ 'update:show': [v: boolean]; created: [id: string] }>();
const message = useMessage();
const saving = ref(false);

const form = reactive({
  name: '',
  province: null as string | null,
  city: null as string | null,
  defaultRate: 15,
  createAccount: false,
  accountUsername: '',
  accountName: '',
  pwdMode: 'auto' as 'auto' | 'manual',
  accountPassword: '',
});

const provinceOptions = PROVINCES.map((p) => ({ label: shortProvinceName(p), value: p }));
const cityOptions = computed(() =>
  form.province
    ? CITIES_BY_PROVINCE[form.province as Province].map((c) => ({ label: c, value: c }))
    : PROVINCES.map((p) => ({
        type: 'group' as const,
        key: p,
        label: shortProvinceName(p),
        children: CITIES_BY_PROVINCE[p].map((c) => ({ label: c, value: c })),
      })),
);
watch(() => form.province, (p) => {
  if (form.city && p && PROVINCE_OF_CITY[form.city] !== p) form.city = null;
});
watch(() => form.city, (c) => {
  if (c && PROVINCE_OF_CITY[c] && form.province !== PROVINCE_OF_CITY[c]) form.province = PROVINCE_OF_CITY[c];
});

const usernameError = computed(() => {
  const v = form.accountUsername.trim();
  if (!v) return '';
  if (v.length < 3) return '至少 3 个字符';
  if (!/^[a-zA-Z0-9_]+$/.test(v)) return '只能包含字母、数字和下划线';
  return '';
});
const passwordError = computed(() => {
  const v = form.accountPassword;
  if (form.pwdMode !== 'manual' || !v) return '';
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,64}$/.test(v)) return '至少 8 位，且同时包含字母和数字';
  return '';
});

function reset() {
  Object.assign(form, {
    name: '', province: null, city: null, defaultRate: 15,
    createAccount: false, accountUsername: '', accountName: '', pwdMode: 'auto', accountPassword: '',
  });
}

/* ---------- 创建成功后展示账号密码 ---------- */
const result = ref<OrgCreateResult | null>(null);
const showResult = ref(false);
const copied = ref(false);

async function copyCredentials() {
  if (!result.value?.account) return;
  const a = result.value.account;
  const text = `机构：${result.value.name}\n登录地址：${location.origin}/login\n账号：${a.username}\n初始密码：${a.password}\n（首次登录后需修改密码）`;
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    message.success('已复制到剪贴板');
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    message.error('复制失败，请手动记录');
  }
}

function closeResult() {
  showResult.value = false;
  if (result.value) emit('created', result.value.id);
  result.value = null;
}

async function submit() {
  if (form.name.trim().length < 2) { message.warning('机构名称至少 2 个字'); return; }
  if (form.createAccount) {
    if (!form.accountUsername.trim()) { message.warning('请填写登录账号'); return; }
    if (usernameError.value) { message.warning(`登录账号${usernameError.value}`); return; }
    if (form.pwdMode === 'manual') {
      if (!form.accountPassword) { message.warning('请设置初始密码'); return; }
      if (passwordError.value) { message.warning(`密码${passwordError.value}`); return; }
    }
  }
  saving.value = true;
  try {
    const res = await orgApi.create({
      name: form.name.trim(),
      province: form.province,
      city: form.city || undefined,
      defaultRate: form.defaultRate,
      createAccount: form.createAccount,
      accountUsername: form.createAccount ? form.accountUsername.trim() : undefined,
      accountName: form.createAccount ? form.accountName.trim() || undefined : undefined,
      accountPassword: form.createAccount && form.pwdMode === 'manual' ? form.accountPassword : undefined,
    });
    reset();
    emit('update:show', false);
    if (res.account) {
      result.value = res;
      showResult.value = true;
    } else {
      message.success(`机构"${res.name}"已创建`);
      emit('created', res.id);
    }
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '创建失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <NDrawer :show="show" :width="480" @update:show="(v) => emit('update:show', v)">
    <NDrawerContent title="新增合作机构" closable>
      <NForm label-placement="top" :show-feedback="false" class="form">
        <NFormItem label="机构名称" required>
          <NInput id="org-create-name" v-model:value="form.name" placeholder="请输入机构全称" maxlength="100" />
        </NFormItem>
        <div class="row">
          <NFormItem label="所在省份" class="col">
            <NSelect v-model:value="form.province" :options="provinceOptions" clearable filterable placeholder="选择省份" />
          </NFormItem>
          <NFormItem label="总部城市" class="col">
            <NSelect id="org-create-city" v-model:value="form.city" :options="cityOptions" clearable filterable placeholder="选择城市" />
          </NFormItem>
        </div>
        <NFormItem label="默认佣金比例">
          <NInputNumber v-model:value="form.defaultRate" :min="0" :max="100" :precision="1" style="width: 50%">
            <template #suffix>%</template>
          </NInputNumber>
        </NFormItem>

        <!-- 机构登录账号 -->
        <section :class="['account-box', { on: form.createAccount }]">
          <header class="account-head">
            <div class="account-icon"><KeyRound :size="16" :stroke-width="1.75" /></div>
            <div class="account-title">
              <div class="t1">同时开通机构登录账号</div>
              <div class="t2">开通后，机构可自行登录系统查看成交、完善资料、上传附件</div>
            </div>
            <NSwitch id="org-create-account" v-model:value="form.createAccount" />
          </header>

          <div v-if="form.createAccount" class="account-body">
            <div class="row">
              <NFormItem label="登录账号" required class="col">
                <NInput
                  id="org-create-username"
                  v-model:value="form.accountUsername"
                  placeholder="如 newstar_edu"
                  maxlength="30"
                  :status="usernameError ? 'error' : undefined"
                />
              </NFormItem>
              <NFormItem label="账号显示名" class="col">
                <NInput v-model:value="form.accountName" placeholder="默认使用机构名称" maxlength="20" />
              </NFormItem>
            </div>
            <div v-if="usernameError" class="field-err">{{ usernameError }}</div>

            <NFormItem label="初始密码" style="margin-top: 12px">
              <NRadioGroup v-model:value="form.pwdMode" name="pwd-mode">
                <NRadio value="auto">系统自动生成</NRadio>
                <NRadio value="manual">手动设置</NRadio>
              </NRadioGroup>
            </NFormItem>
            <NInput
              v-if="form.pwdMode === 'manual'"
              id="org-create-password"
              v-model:value="form.accountPassword"
              type="password"
              show-password-on="click"
              placeholder="至少 8 位，包含字母和数字"
              maxlength="64"
              :status="passwordError ? 'error' : undefined"
              style="margin-top: 8px"
            />
            <div v-if="passwordError" class="field-err">{{ passwordError }}</div>

            <div class="tip">
              <Info :size="14" :stroke-width="1.75" />
              <span>创建成功后会弹窗显示账号和初始密码，请复制发给机构。机构首次登录时必须修改密码。</span>
            </div>
          </div>
        </section>
      </NForm>

      <template #footer>
        <div class="footer">
          <button class="btn btn-ghost" @click="emit('update:show', false)">取消</button>
          <button id="org-create-submit" class="btn" :disabled="saving" @click="submit">
            {{ saving ? '创建中...' : form.createAccount ? '创建机构并开通账号' : '创建机构' }}
          </button>
        </div>
      </template>
    </NDrawerContent>
  </NDrawer>

  <!-- 账号开通结果 -->
  <NModal :show="showResult" :mask-closable="false" @update:show="(v) => !v && closeResult()">
    <div v-if="result?.account" class="card result-card">
      <div class="result-icon"><ShieldCheck :size="22" :stroke-width="1.75" /></div>
      <h3 class="result-title">机构已创建，登录账号已开通</h3>
      <p class="result-sub">初始密码只显示这一次，关闭后无法再查看（可在账号管理中重置）。</p>

      <dl class="cred">
        <div><dt>机构</dt><dd>{{ result.name }}</dd></div>
        <div><dt>登录账号</dt><dd class="mono">{{ result.account.username }}</dd></div>
        <div><dt>初始密码</dt><dd class="mono strong">{{ result.account.password }}</dd></div>
      </dl>

      <div class="result-actions">
        <button id="cred-copy" class="btn btn-ghost" @click="copyCredentials">
          <component :is="copied ? Check : Copy" :size="14" /> {{ copied ? '已复制' : '复制账号信息' }}
        </button>
        <button id="cred-done" class="btn" @click="closeResult">我已记录，进入机构详情</button>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.form :deep(.n-form-item) {
  margin-bottom: 14px;
}
.row {
  display: flex;
  gap: 12px;
}
.col {
  flex: 1;
  min-width: 0;
}
.account-box {
  margin-top: 8px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-2, #fafbfc);
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.account-box.on {
  border-color: var(--brand);
  background: var(--surface, #fff);
  box-shadow: 0 0 0 3px var(--brand-soft);
}
.account-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}
.account-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--brand-soft);
  color: var(--brand);
  flex-shrink: 0;
}
.account-title {
  flex: 1;
  min-width: 0;
}
.t1 {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}
.t2 {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 2px;
  line-height: 1.5;
}
.account-body {
  padding: 4px 16px 16px;
  border-top: 1px dashed var(--border);
  padding-top: 14px;
}
.account-body :deep(.n-form-item) {
  margin-bottom: 0;
}
.field-err {
  font-size: 12px;
  color: var(--danger);
  margin-top: 4px;
}
.tip {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--info-soft);
  color: var(--info);
  font-size: 12px;
  line-height: 1.6;
}
.tip svg {
  flex-shrink: 0;
  margin-top: 2px;
}
.footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.result-card {
  width: 440px;
  padding: 28px 28px 24px;
  text-align: center;
}
.result-icon {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--brand);
}
.result-title {
  margin: 14px 0 6px;
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
}
.result-sub {
  margin: 0;
  font-size: 13px;
  color: var(--warning);
}
.cred {
  margin: 20px 0;
  padding: 4px 16px;
  border-radius: 10px;
  background: var(--surface-2, #f6f7f9);
  border: 1px solid var(--border);
  text-align: left;
}
.cred > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  font-size: 13px;
}
.cred > div + div {
  border-top: 1px solid var(--border);
}
.cred dt {
  color: var(--text-3);
}
.cred dd {
  margin: 0;
  color: var(--text);
  text-align: right;
  word-break: break-all;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.strong {
  font-weight: 600;
  font-size: 15px;
  color: var(--brand);
  letter-spacing: 0.5px;
}
.result-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}
</style>
