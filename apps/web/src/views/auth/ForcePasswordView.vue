<script setup lang="ts">
import { useRouter } from 'vue-router';
import { KeyRound } from 'lucide-vue-next';
import type { UserProfile } from '@bdcrm/shared';
import LogoMark from '@/components/LogoMark.vue';
import PasswordForm from '@/components/PasswordForm.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

function onSuccess(user: UserProfile) {
  auth.setUser(user);
  // 机构账号首次登录后引导完善机构资料
  router.replace(user.role === 'ORG' ? '/my-org' : '/');
}

async function logout() {
  await auth.logout();
  router.replace('/login');
}
</script>

<template>
  <div class="force">
    <div class="force-card card rise-in">
      <div class="force-head">
        <LogoMark :size="28" />
        <button id="force-logout" class="link-btn" @click="logout">退出登录</button>
      </div>
      <div class="force-icon"><KeyRound :size="22" :stroke-width="1.75" /></div>
      <h1 class="force-title">首次登录，请修改初始密码</h1>
      <p class="force-sub">
        {{ auth.user?.name }}，为了账号安全，请将管理员分配的初始密码修改为仅你本人知道的密码。
      </p>
      <PasswordForm submit-text="修改并进入系统" block @success="onSuccess" />
    </div>
  </div>
</template>

<style scoped>
.force {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(ellipse 60% 50% at 50% 0%, var(--brand-soft), transparent 70%),
    var(--bg);
}
.force-card {
  width: 100%;
  max-width: 440px;
  padding: 28px 32px 32px;
}
.force-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
}
.force-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--brand-soft);
  color: var(--brand);
  margin-bottom: 16px;
}
.force-title {
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.force-sub {
  margin: 8px 0 24px;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.7;
}
</style>
