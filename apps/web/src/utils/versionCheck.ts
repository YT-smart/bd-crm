import type { Router } from 'vue-router';

/**
 * 部署后让已打开的页面自动用上新版：
 * - 切回标签页、或每隔一段时间，拉一次 index.html，对比入口脚本文件名
 * - 发现有新版本后，不打断当前操作，等下一次切换页面时整页刷新
 * - 旧版本按需加载的页面文件已被删除（加载失败）时，直接刷新
 */
const ENTRY_RE = /\/assets\/index-[\w-]+\.js/;
const CHECK_INTERVAL = 5 * 60 * 1000;

function currentEntry(): string | null {
  for (const s of Array.from(document.scripts)) {
    const m = s.src.match(ENTRY_RE);
    if (m) return m[0];
  }
  return null;
}

export function setupVersionCheck(router: Router) {
  if (import.meta.env.DEV) return;
  const mine = currentEntry();
  if (!mine) return;

  let outdated = false;
  let checking = false;

  async function check() {
    if (outdated || checking) return;
    checking = true;
    try {
      const html = await fetch(`/index.html?t=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());
      const latest = html.match(ENTRY_RE)?.[0];
      if (latest && latest !== mine) outdated = true;
    } catch {
      /* 网络异常时忽略，下次再查 */
    } finally {
      checking = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  setInterval(check, CHECK_INTERVAL);

  // 有新版本时，在切换页面这一刻整页跳转到目标地址，拿到新版
  router.beforeEach((to, from) => {
    if (outdated && from.matched.length) {
      window.location.assign(to.fullPath);
      return false;
    }
    return true;
  });

  // 旧版本的页面文件已不存在：刷新到目标地址
  const reloadKey = 'bdcrm:chunk-reload';
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    // 防止新版本本身出错时无限刷新
    if (sessionStorage.getItem(reloadKey)) return;
    sessionStorage.setItem(reloadKey, '1');
    window.location.reload();
  });
  router.onError((err, to) => {
    if (/dynamically imported module|Importing a module script failed|Failed to fetch/i.test(String(err?.message))) {
      if (sessionStorage.getItem(reloadKey)) return;
      sessionStorage.setItem(reloadKey, '1');
      window.location.assign(to.fullPath);
    }
  });
  router.afterEach((_to, _from, failure) => {
    if (!failure) sessionStorage.removeItem(reloadKey);
  });
}
