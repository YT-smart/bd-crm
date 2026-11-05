import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { KICKED_OUT_CODE, type Perm, type UserProfile } from '@bdcrm/shared';
import { ApiError } from '@/api/http';
import { authApi } from '@/api';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null);
  /** 是否已尝试过从 Cookie 恢复登录态 */
  const restored = ref(false);
  /** 登录页提示（如：账号已在其他设备登录） */
  const notice = ref('');

  const permSet = computed(() => new Set(user.value?.permissions ?? []));
  const isLoggedIn = computed(() => !!user.value);

  /** 拥有任意一个权限即返回 true */
  function can(perm?: Perm | Perm[]) {
    if (!perm) return true;
    const list = Array.isArray(perm) ? perm : [perm];
    return list.some((p) => permSet.value.has(p));
  }

  async function restore() {
    if (restored.value) return;
    try {
      user.value = await authApi.me();
    } catch (e) {
      user.value = null;
      if (e instanceof ApiError && e.code === KICKED_OUT_CODE) notice.value = e.message;
    } finally {
      restored.value = true;
    }
  }

  async function login(username: string, password: string) {
    user.value = await authApi.login(username, password);
    restored.value = true;
    notice.value = '';
    return user.value;
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      user.value = null;
    }
  }

  function setUser(u: UserProfile | null) {
    user.value = u;
  }

  return { user, restored, notice, isLoggedIn, can, restore, login, logout, setUser };
});
