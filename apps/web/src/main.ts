import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@fontsource-variable/inter';
import './styles/index.css';
import App from './App.vue';
import { router } from './router';
import { onUnauthorized } from './api/http';
import { useAuthStore } from './stores/auth';

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.use(router);

// 任意接口返回 401：清空登录态并回到登录页
onUnauthorized(() => {
  const auth = useAuthStore(pinia);
  auth.setUser(null);
  const current = router.currentRoute.value;
  if (!current.meta.public) {
    router.replace({ name: 'login', query: { redirect: current.fullPath } });
  }
});

app.mount('#app');
