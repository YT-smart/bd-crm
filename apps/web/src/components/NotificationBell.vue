<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NPopover, NSpin, NTooltip } from 'naive-ui';
import { ArrowRight, Bell, Building2, CheckCheck, ChevronLeft, HandCoins, Lock, UserPlus } from 'lucide-vue-next';
import {
  NOTIFICATION_CATEGORY_LABEL,
  NOTIFICATION_CATEGORY_PERM,
  type ChangeLine,
  type NotificationCategory,
  type NotificationItem,
  type NotificationUnread,
} from '@bdcrm/shared';
import { notificationApi } from '@/api';
import { useAuthStore } from '@/stores/auth';

/**
 * 消息提醒入口（侧边栏头像上方）：红点未读数 + 消息弹层，点击消息跳到对应详情。
 * 未读数每分钟轮询一次，窗口重新获得焦点时立即刷新。
 */
defineProps<{ collapsed: boolean }>();
const router = useRouter();

const unread = ref<NotificationUnread>({ ALL: 0, ORG: 0, LEAD: 0, DEAL: 0 });
const badge = computed(() => (unread.value.ALL > 99 ? '99+' : String(unread.value.ALL)));

async function refreshCount() {
  try {
    unread.value = await notificationApi.unreadCount();
  } catch {
    /* 轮询失败忽略，下次再取 */
  }
}

let timer: ReturnType<typeof setInterval> | undefined;
const onFocus = () => void refreshCount();
onMounted(() => {
  refreshCount();
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') refreshCount();
  }, 60_000);
  window.addEventListener('focus', onFocus);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  window.removeEventListener('focus', onFocus);
});

/* ---------- 弹层 ---------- */
type Tab = 'ALL' | NotificationCategory;
const auth = useAuthStore();
/** 只显示当前账号能收到的分类（员工只有机构资料） */
const TABS = computed(() => {
  const cats = (['ORG', 'LEAD', 'DEAL'] as NotificationCategory[]).filter((c) => auth.can(NOTIFICATION_CATEGORY_PERM[c]));
  const tabs: { key: Tab; label: string }[] = cats.map((c) => ({ key: c, label: NOTIFICATION_CATEGORY_LABEL[c] }));
  return cats.length > 1 ? [{ key: 'ALL' as Tab, label: '全部' }, ...tabs] : tabs;
});
const tab = ref<Tab>('ALL');
watch(TABS, (t) => { if (!t.some((x) => x.key === tab.value)) tab.value = t[0]?.key ?? 'ALL'; }, { immediate: true });
const CATEGORY_ICON = { ORG: Building2, LEAD: UserPlus, DEAL: HandCoins } as const;

const show = ref(false);
const unreadOnly = ref(false);
const list = ref<NotificationItem[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const PAGE_SIZE = 20;
let seq = 0;

async function load(reset = true) {
  const my = ++seq;
  if (reset) page.value = 1;
  loading.value = true;
  try {
    const r = await notificationApi.list({
      category: tab.value === 'ALL' ? undefined : tab.value,
      unreadOnly: unreadOnly.value || undefined,
      page: page.value,
      pageSize: PAGE_SIZE,
    });
    if (my !== seq) return;
    list.value = reset ? r.list : [...list.value, ...r.list];
    total.value = r.total;
    unread.value = r.unread;
  } catch {
    /* 加载失败保持原列表 */
  } finally {
    if (my === seq) loading.value = false;
  }
}
function loadMore() {
  page.value += 1;
  load(false);
}

watch(show, (v) => {
  if (v) load();
  else detail.value = null;
});
watch([tab, unreadOnly], () => load());

/** 机构资料提醒：点开先看具体改了什么，再决定要不要去机构详情 */
const detail = ref<NotificationItem | null>(null);

async function open(n: NotificationItem) {
  if (!n.read) {
    n.read = true;
    unread.value = { ...unread.value, ALL: Math.max(0, unread.value.ALL - 1), [n.category]: Math.max(0, unread.value[n.category] - 1) };
    notificationApi.read(n.id).catch(() => refreshCount());
  }
  if (n.changes?.length) {
    detail.value = n;
    return;
  }
  go(n.link);
}
function go(link: string | null) {
  show.value = false;
  if (link) router.push(link);
}

/** 明细按时间倒序，最新的修改在最上面 */
const detailChanges = computed(() => [...(detail.value?.changes ?? [])].reverse());
/** 新增 / 删除整项只显示一行；修改字段显示「原来 → 现在」 */
function kindOf(c: ChangeLine): 'add' | 'remove' | 'edit' {
  if (/^(新增|上传)/.test(c.label)) return 'add';
  if (/^删除/.test(c.label)) return 'remove';
  return 'edit';
}
function timeOf(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function readAll() {
  const category = tab.value === 'ALL' ? undefined : tab.value;
  await notificationApi.readAll(category).catch(() => null);
  list.value = list.value.map((n) => ({ ...n, read: true }));
  if (unreadOnly.value) list.value = [];
  await refreshCount();
}

/** 弹层里滚动不带动后面的页面：列表滚到头（或内容不够滚）时吞掉滚轮事件 */
const listEl = ref<HTMLDivElement | null>(null);
function onWheel(e: WheelEvent) {
  const el = listEl.value;
  if (el && el.contains(e.target as Node)) {
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) return;
  }
  e.preventDefault();
}

function ago(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
</script>

<template>
  <NPopover v-model:show="show" trigger="click" placement="right-end" :show-arrow="false" raw>
    <template #trigger>
      <span>
        <NTooltip placement="right" :disabled="!collapsed" :show-arrow="false">
          <template #trigger>
            <button id="notify-trigger" class="notify-btn" :class="{ collapsed, active: show }" aria-label="消息提醒">
              <span class="bell">
                <Bell :size="16" :stroke-width="1.75" />
                <span v-if="unread.ALL && collapsed" class="dot" />
              </span>
              <span v-show="!collapsed" class="notify-label">消息提醒</span>
              <span v-if="unread.ALL && !collapsed" class="count">{{ badge }}</span>
            </button>
          </template>
          消息提醒{{ unread.ALL ? `（${badge} 条未读）` : '' }}
        </NTooltip>
      </span>
    </template>

    <div class="np" @wheel="onWheel">
      <header class="np-head">
        <span class="np-title">消息提醒</span>
        <label class="np-unread-only">
          <input v-model="unreadOnly" type="checkbox" /> 只看未读
        </label>
        <button class="np-readall" :disabled="!unread[tab]" @click="readAll">
          <CheckCheck :size="14" :stroke-width="1.75" /> 全部已读
        </button>
      </header>

      <!-- 修改明细 -->
      <div v-if="detail" class="np-detail">
        <div class="nd-head">
          <button class="nd-back" @click="detail = null"><ChevronLeft :size="16" :stroke-width="1.75" /> 返回</button>
          <span class="nd-title ellipsis">{{ detail.title }}</span>
        </div>
        <div class="nd-list">
          <div v-for="(c, i) in detailChanges" :key="i" class="nd-row">
            <div class="nd-label">
              <span>{{ c.label }}</span>
              <span class="nd-time">{{ timeOf(c.at) }}</span>
            </div>
            <div v-if="c.hidden" class="nd-hidden"><Lock :size="12" :stroke-width="1.75" /> 具体内容仅管理员可见</div>
            <template v-else-if="kindOf(c) === 'add'">
              <div class="nd-val after"><span class="nd-tag">新增</span><span class="nd-text">{{ c.after }}</span></div>
            </template>
            <template v-else-if="kindOf(c) === 'remove'">
              <div class="nd-val before"><span class="nd-tag">删除</span><span class="nd-text">{{ c.before }}</span></div>
            </template>
            <template v-else>
              <div class="nd-val before"><span class="nd-tag">原来</span><span class="nd-text">{{ c.before ?? '（空）' }}</span></div>
              <div class="nd-val after"><span class="nd-tag">现在</span><span class="nd-text">{{ c.after ?? '（空）' }}</span></div>
            </template>
          </div>
        </div>
        <button v-if="detail.link" class="nd-go" @click="go(detail.link)">
          查看机构详情 <ArrowRight :size="14" :stroke-width="1.75" />
        </button>
      </div>

      <template v-else>
      <div class="np-tabs">
        <button v-for="t in TABS" :key="t.key" :class="['np-tab', { active: tab === t.key }]" @click="tab = t.key">
          {{ t.label }}
          <span v-if="unread[t.key]" class="np-tab-count">{{ unread[t.key] > 99 ? '99+' : unread[t.key] }}</span>
        </button>
      </div>

      <div ref="listEl" class="np-list">
        <button v-for="n in list" :key="n.id" :class="['np-item', { unread: !n.read }]" @click="open(n)">
          <span :class="['np-icon', `c-${n.category}`]">
            <component :is="CATEGORY_ICON[n.category]" :size="15" :stroke-width="1.75" />
          </span>
          <span class="np-body">
            <span class="np-item-title">{{ n.title }}</span>
            <span v-if="n.content" class="np-item-content">{{ n.content }}</span>
            <span class="np-meta">
              {{ NOTIFICATION_CATEGORY_LABEL[n.category] }} · {{ ago(n.updatedAt) }}
            </span>
          </span>
          <span v-if="!n.read" class="np-dot" />
        </button>

        <div v-if="loading && !list.length" class="np-empty"><NSpin size="small" /></div>
        <div v-else-if="!list.length" class="np-empty">
          <Bell :size="26" :stroke-width="1.4" />
          <span>{{ unreadOnly ? '没有未读消息' : '暂无消息' }}</span>
        </div>
        <button v-if="list.length < total" class="np-more" :disabled="loading" @click="loadMore">
          {{ loading ? '加载中...' : '加载更多' }}
        </button>
      </div>
      </template>
    </div>
  </NPopover>
</template>

<style scoped>
.notify-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}
.notify-btn:hover,
.notify-btn.active {
  color: var(--text);
  background: var(--neutral-soft);
}
.notify-btn.collapsed {
  justify-content: center;
  padding: 0;
}
.bell {
  position: relative;
  display: inline-flex;
}
.dot {
  position: absolute;
  top: -2px;
  right: -3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
  box-shadow: 0 0 0 2px var(--bg-subtle);
}
.notify-label {
  flex: 1;
  text-align: left;
}
.count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--danger);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

.np {
  width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-pop);
  overflow: hidden;
}
.np-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px 8px;
}
.np-title {
  flex: 1;
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
}
.np-unread-only {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-2);
  cursor: pointer;
}
.np-readall {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--brand);
  font-size: 12px;
  cursor: pointer;
}
.np-readall:hover:not(:disabled) { background: var(--brand-soft); }
.np-readall:disabled { color: var(--text-3); cursor: default; }

.np-tabs {
  display: flex;
  gap: 2px;
  padding: 0 10px;
  border-bottom: 1px solid var(--border);
}
.np-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 8px 8px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
}
.np-tab.active { color: var(--brand); border-bottom-color: var(--brand); font-weight: 500; }
.np-tab-count {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
}

.np-list {
  /* 固定高度：切换分类、条数多少，弹层大小都不变 */
  height: min(460px, calc(100vh - 160px));
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 0;
}
.np-item {
  position: relative;
  display: flex;
  gap: 10px;
  width: 100%;
  padding: 10px 28px 10px 14px;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.np-item:hover { background: var(--neutral-soft); }
.np-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
}
.c-ORG { background: var(--info-soft); color: var(--info); }
.c-LEAD { background: var(--warning-soft); color: var(--warning); }
.c-DEAL { background: var(--success-soft); color: var(--success); }
.np-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.np-item-title {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.4;
}
.np-item.unread .np-item-title { color: var(--text); font-weight: 600; }
.np-item-content {
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}
.np-meta {
  font-size: 11.5px;
  color: var(--text-3);
}
.np-dot {
  position: absolute;
  top: 16px;
  right: 14px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--danger);
}
.np-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  justify-content: center;
  height: 100%;
  color: var(--text-3);
  font-size: 13px;
}
.np-detail {
  display: flex;
  flex-direction: column;
  /* 和列表一样高：标签栏 + 列表 */
  height: calc(min(460px, calc(100vh - 160px)) + 37px);
}
.nd-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px 8px 8px;
  border-bottom: 1px solid var(--border);
}
.nd-back {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 3px 6px 3px 2px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font-size: 12.5px;
  cursor: pointer;
}
.nd-back:hover { background: var(--neutral-soft); color: var(--text); }
.nd-title {
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.nd-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 14px;
}
.nd-row {
  padding: 10px 0;
  border-bottom: 1px dashed var(--border);
}
.nd-row:last-child { border-bottom: 0; }
.nd-label {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}
.nd-time {
  flex-shrink: 0;
  font-size: 11.5px;
  font-weight: 400;
  color: var(--text-3);
}
.nd-val {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  font-size: 12.5px;
  line-height: 1.55;
}
.nd-tag {
  flex-shrink: 0;
  height: 18px;
  padding: 0 5px;
  border-radius: 4px;
  font-size: 11px;
  line-height: 18px;
}
.nd-val.before .nd-tag { background: var(--neutral-soft); color: var(--text-3); }
.nd-val.after .nd-tag { background: var(--success-soft); color: var(--success); }
.nd-text {
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-all;
}
.nd-val.before .nd-text { color: var(--text-3); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--text-3) 50%, transparent); }
.nd-val.after .nd-text { color: var(--text); }
.nd-hidden {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-3);
}
.nd-go {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin: 0;
  padding: 10px;
  border: 0;
  border-top: 1px solid var(--border);
  background: transparent;
  color: var(--brand);
  font-size: 13px;
  cursor: pointer;
}
.nd-go:hover { background: var(--brand-soft); }
.np-more {
  display: block;
  width: 100%;
  padding: 10px;
  border: 0;
  background: transparent;
  color: var(--brand);
  font-size: 12.5px;
  cursor: pointer;
}
</style>
