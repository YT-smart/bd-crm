import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource-variable/inter';
import './styles/index.css';
import App from './App.vue';
import { router } from './router';
import { KICKED_OUT_CODE } from '@bdcrm/shared';
import { onUnauthorized } from './api/http';
import { useAuthStore } from './stores/auth';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

// 任意接口返回 401：清空登录态并回到登录页
onUnauthorized((err) => {
  const auth = useAuthStore(pinia);
  auth.setUser(null);
  // 被其他设备的登录挤下线：登录页给出提示
  if (err.code === KICKED_OUT_CODE) auth.notice = err.message;
  const current = router.currentRoute.value;
  if (!current.meta.public) {
    router.replace({ name: 'login', query: { redirect: current.fullPath } });
  }
});

app.mount('#app');
