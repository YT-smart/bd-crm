<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { NButton, NForm, NFormItem, NInput, type FormInst, type FormRules } from 'naive-ui';
import { BarChart3, Building2, Eye, EyeOff, LockKeyhole, MonitorSmartphone, ShieldCheck, User } from 'lucide-vue-next';
import LogoMark from '@/components/LogoMark.vue';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const formRef = ref<FormInst | null>(null);
const form = reactive({ username: '', password: '' });
const loading = ref(false);
const error = ref('');
const showPwd = ref(false);
const isDev = import.meta.env.DEV;

const rules: FormRules = {
  username: { required: true, message: '请输入账号', trigger: 'blur' },
  password: { required: true, message: '请输入密码', trigger: 'blur' },
};

const FEATURES = [
  { icon: Building2, title: '机构档案', desc: '联系人、产品报价、合作信息集中管理，资料完整度一目了然' },
  { icon: ShieldCheck, title: '成交审核与结算', desc: '机构自报成交，员工审核，管理员确认到账，全程留痕' },
  { icon: BarChart3, title: '经营看板', desc: '成交额、佣金收入、地区分布与机构贡献实时统计' },
];

async function submit() {
  error.value = '';
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  loading.value = true;
  try {
    const user = await auth.login(form.username.trim(), form.password);
    if (user.mustChangePwd) {
      router.replace({ name: 'force-password' });
    } else {
      const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
      router.replace(redirect);
    }
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : '登录失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}

function fillDemo(username: string, password: string) {
  form.username = username;
  form.password = password;
  error.value = '';
}
</script>

<template>
  <div class="login">
    <section class="hero" aria-hidden="true">
      <div class="hero-grid" />
      <div class="hero-glow" />
      <div class="hero-inner">
        <div class="hero-brand">
          <LogoMark :size="32" />
          <span>BD-CRM</span>
        </div>

        <div class="hero-copy rise-in">
          <p class="eyebrow">Partner Relationship Management</p>
          <h2>留学合作机构<br />管理平台</h2>
          <p class="hero-desc">面向留学合作业务的伙伴管理系统，连接机构、员工与管理者。</p>
        </div>

        <ul class="features">
          <li v-for="(f, i) in FEATURES" :key="f.title" class="feature rise-in" :style="{ animationDelay: `${120 + i * 80}ms` }">
            <span class="feature-icon"><component :is="f.icon" :size="18" :stroke-width="1.75" /></span>
            <div>
              <div class="feature-title">{{ f.title }}</div>
              <div class="feature-desc">{{ f.desc }}</div>
            </div>
          </li>
        </ul>

        <p class="hero-foot">© {{ new Date().getFullYear() }} BD-CRM · 内部系统，仅限授权人员使用</p>
      </div>
    </section>

    <section class="panel">
      <div class="panel-inner rise-in">
        <div class="panel-brand-mobile">
          <LogoMark :size="28" />
          <span>BD-CRM</span>
        </div>
        <h1 class="panel-title">登录账号</h1>
        <p class="panel-sub">使用管理员分配的账号登录</p>

        <div v-if="auth.notice" id="login-notice" class="login-notice" role="alert">
          <MonitorSmartphone :size="16" :stroke-width="1.75" class="notice-ic" />
          <span>{{ auth.notice }}</span>
        </div>

        <NForm ref="formRef" :model="form" :rules="rules" :show-require-mark="false" size="large" @submit.prevent="submit">
          <NFormItem label="账号" path="username">
            <NInput
              id="login-username"
              v-model:value="form.username"
              placeholder="请输入账号"
              :input-props="{ autocomplete: 'username' }"
              @keyup.enter="submit"
            >
              <template #prefix><User :size="16" :stroke-width="1.75" class="text-3" /></template>
            </NInput>
          </NFormItem>
          <NFormItem label="密码" path="password">
            <NInput
              id="login-password"
              v-model:value="form.password"
              :type="showPwd ? 'text' : 'password'"
              placeholder="请输入密码"
              :input-props="{ autocomplete: 'current-password' }"
              @keyup.enter="submit"
            >
              <template #prefix><LockKeyhole :size="16" :stroke-width="1.75" class="text-3" /></template>
              <template #suffix>
                <button type="button" class="pwd-eye" :aria-label="showPwd ? '隐藏密码' : '显示密码'" @click="showPwd = !showPwd">
                  <component :is="showPwd ? EyeOff : Eye" :size="16" :stroke-width="1.75" />
                </button>
              </template>
            </NInput>
          </NFormItem>

          <Transition name="fade-slide">
            <div v-if="error" id="login-error" class="form-error" role="alert">{{ error }}</div>
          </Transition>

          <NButton id="login-submit" type="primary" size="large" block attr-type="submit" :loading="loading" class="submit">
            登录
          </NButton>
        </NForm>

        <p class="panel-hint">忘记密码请联系管理员重置。连续输错 5 次密码将锁定 15 分钟。</p>

        <div v-if="isDev" class="demo">
          <div class="demo-title">开发环境演示账号</div>
          <div class="demo-list">
            <button id="demo-admin" type="button" @click="fillDemo('admin', 'Admin@123')">管理员 admin</button>
            <button id="demo-staff" type="button" @click="fillDemo('staff01', 'Staff@123')">员工 staff01</button>
            <button id="demo-org" type="button" @click="fillDemo('org01', 'Org@12345')">机构 org01</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-notice {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin: 0 0 18px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
  background: var(--warning-soft);
  color: var(--text);
  font-size: 13px;
  line-height: 1.55;
}
.notice-ic {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--warning);
}
.login {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(420px, 1fr);
  min-height: 100vh;
  background: var(--surface);
}

/* ---------- 左侧品牌区 ---------- */
.hero {
  position: relative;
  overflow: hidden;
  color: #e7ebff;
  background: linear-gradient(155deg, #172061 0%, #22318f 46%, #3b5bdb 100%);
}
.hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse 80% 70% at 30% 40%, #000 30%, transparent 75%);
}
.hero-glow {
  position: absolute;
  width: 560px;
  height: 560px;
  right: -180px;
  bottom: -200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(145, 167, 255, 0.45), transparent 65%);
  filter: blur(10px);
  animation: drift 14s ease-in-out infinite alternate;
}
@keyframes drift {
  to {
    transform: translate(-60px, -40px) scale(1.08);
  }
}
.hero-inner {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 40px 56px;
}
.hero-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.02em;
  color: #fff;
}
.hero-brand :deep(rect) {
  fill: rgba(255, 255, 255, 0.16);
}
.hero-copy {
  margin-top: auto;
}
.eyebrow {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(231, 235, 255, 0.6);
  margin-bottom: 16px;
}
.hero-copy h2 {
  font-size: 40px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: #fff;
}
.hero-desc {
  margin-top: 16px;
  max-width: 420px;
  font-size: 15px;
  color: rgba(231, 235, 255, 0.72);
}
.features {
  list-style: none;
  margin: 40px 0 0;
  padding: 0;
  display: grid;
  gap: 12px;
  max-width: 460px;
}
.feature {
  display: flex;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(6px);
}
.feature-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.feature-title {
  font-weight: 600;
  color: #fff;
  font-size: 14px;
}
.feature-desc {
  margin-top: 2px;
  font-size: 13px;
  color: rgba(231, 235, 255, 0.68);
}
.hero-foot {
  margin-top: auto;
  padding-top: 40px;
  font-size: 12px;
  color: rgba(231, 235, 255, 0.45);
}

/* ---------- 右侧表单 ---------- */
.panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background: var(--surface);
}
.panel-inner {
  width: 100%;
  max-width: 380px;
}
.panel-brand-mobile {
  display: none;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  margin-bottom: 32px;
}
.panel-title {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.panel-sub {
  margin: 6px 0 28px;
  color: var(--text-3);
}
.pwd-eye {
  display: inline-flex;
  border: 0;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  padding: 2px;
}
.pwd-eye:hover {
  color: var(--text);
}
.form-error {
  margin: -6px 0 16px;
  padding: 10px 12px;
  border-radius: var(--radius);
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 13px;
}
.submit {
  margin-top: 4px;
  height: 44px;
  font-size: 15px;
}
.panel-hint {
  margin-top: 20px;
  font-size: 12px;
  color: var(--text-3);
  line-height: 1.7;
}
.demo {
  margin-top: 28px;
  padding: 14px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
}
.demo-title {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 10px;
}
.demo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.demo-list button {
  border: 1px solid var(--border);
  background: var(--bg-subtle);
  color: var(--text-2);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.demo-list button:hover {
  color: var(--brand);
  border-color: var(--brand);
  background: var(--brand-soft);
}

@media (max-width: 960px) {
  .login {
    grid-template-columns: 1fr;
  }
  .hero {
    display: none;
  }
  .panel-brand-mobile {
    display: flex;
  }
}
</style>
