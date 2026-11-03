<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { NButton, NForm, NFormItem, NInput, useMessage, type FormInst, type FormItemRule, type FormRules } from 'naive-ui';
import type { UserProfile } from '@bdcrm/shared';
import { authApi } from '@/api';
import { ApiError } from '@/api/http';

withDefaults(defineProps<{ submitText?: string; block?: boolean }>(), { submitText: '保存新密码', block: false });
const emit = defineEmits<{ (e: 'success', user: UserProfile): void }>();

const message = useMessage();
const formRef = ref<FormInst | null>(null);
const loading = ref(false);
const form = reactive({ oldPassword: '', newPassword: '', confirm: '' });

const RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

const rules: FormRules = {
  oldPassword: { required: true, message: '请输入当前密码', trigger: 'blur' },
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { pattern: RULE, message: '至少 8 位，且同时包含字母和数字', trigger: ['blur', 'input'] },
  ],
  confirm: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_r: FormItemRule, v: string) => v === form.newPassword,
      message: '两次输入的密码不一致',
      trigger: ['blur', 'input'],
    },
  ],
};

/** 简单强度指示：0-3 */
const strength = computed(() => {
  const p = form.newPassword;
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Za-z]/.test(p) && /\d/.test(p)) s++;
  if (p.length >= 12 || /[^A-Za-z0-9]/.test(p)) s++;
  return s;
});
const strengthLabel = computed(() => ['', '弱', '中', '强'][strength.value]);

async function submit() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  loading.value = true;
  try {
    const user = await authApi.changePassword(form.oldPassword, form.newPassword);
    message.success('密码已修改');
    form.oldPassword = form.newPassword = form.confirm = '';
    emit('success', user);
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '修改失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NForm ref="formRef" :model="form" :rules="rules" :show-require-mark="false" @submit.prevent="submit">
    <NFormItem label="当前密码" path="oldPassword">
      <NInput
        id="pwd-old"
        v-model:value="form.oldPassword"
        type="password"
        show-password-on="click"
        placeholder="请输入当前密码"
        :input-props="{ autocomplete: 'current-password' }"
      />
    </NFormItem>
    <NFormItem label="新密码" path="newPassword">
      <div class="new-pwd">
        <NInput
          id="pwd-new"
          v-model:value="form.newPassword"
          type="password"
          show-password-on="click"
          placeholder="至少 8 位，包含字母和数字"
          :input-props="{ autocomplete: 'new-password' }"
        />
        <div v-if="form.newPassword" class="strength" :data-level="strength">
          <i /><i /><i />
          <span>{{ strengthLabel }}</span>
        </div>
      </div>
    </NFormItem>
    <NFormItem label="确认新密码" path="confirm">
      <NInput
        id="pwd-confirm"
        v-model:value="form.confirm"
        type="password"
        show-password-on="click"
        placeholder="再次输入新密码"
        :input-props="{ autocomplete: 'new-password' }"
        @keyup.enter="submit"
      />
    </NFormItem>
    <NButton id="pwd-submit" type="primary" attr-type="submit" :loading="loading" :block="block">{{ submitText }}</NButton>
  </NForm>
</template>

<style scoped>
.new-pwd {
  width: 100%;
}
.strength {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.strength i {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  transition: background-color 0.2s;
}
.strength span {
  margin-left: 6px;
}
.strength[data-level='1'] i:nth-child(-n + 1) {
  background: var(--danger);
}
.strength[data-level='2'] i:nth-child(-n + 2) {
  background: var(--warning);
}
.strength[data-level='3'] i:nth-child(-n + 3) {
  background: var(--success);
}
</style>
