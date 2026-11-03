<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NModal } from 'naive-ui';
import { useDebounceFn } from '@vueuse/core';
import { Building2, CornerDownLeft, Search } from 'lucide-vue-next';
import { PERM, shortProvinceName, type OrgListItem } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { NAV_ITEMS } from './nav';

const show = defineModel<boolean>('show', { required: true });

const router = useRouter();
const auth = useAuthStore();

const keyword = ref('');
const orgs = ref<OrgListItem[]>([]);
const loading = ref(false);
const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement>();

interface ResultItem {
  id: string;
  group: string;
  label: string;
  sub?: string;
  icon: unknown;
  to: string | { path: string; query?: Record<string, string> };
}

const pages = computed<ResultItem[]>(() => {
  const kw = keyword.value.trim().toLowerCase();
  return NAV_ITEMS.filter((i) => auth.can(i.perm))
    .filter((i) => !kw || i.label.includes(kw) || i.keywords?.toLowerCase().includes(kw))
    .map((i) => ({ id: `page-${i.key}`, group: '页面', label: i.label, icon: i.icon, to: i.to }));
});

const results = computed<ResultItem[]>(() => [
  ...pages.value,
  ...orgs.value.map((o) => ({
    id: `org-${o.id}`,
    group: '合作机构',
    label: o.name,
    sub: [o.province ? shortProvinceName(o.province) : null, o.city].filter(Boolean).join(' · '),
    icon: Building2,
    to: { path: '/orgs', query: { keyword: o.name } },
  })),
]);

const groups = computed(() => {
  const map = new Map<string, { item: ResultItem; index: number }[]>();
  results.value.forEach((item, index) => {
    const arr = map.get(item.group) ?? [];
    arr.push({ item, index });
    map.set(item.group, arr);
  });
  return [...map.entries()];
});

const searchOrgs = useDebounceFn(async (kw: string) => {
  if (!kw || !auth.can(PERM.ORG_VIEW)) {
    orgs.value = [];
    loading.value = false;
    return;
  }
  try {
    const res = await orgApi.list({ keyword: kw, page: 1, pageSize: 6 });
    if (kw === keyword.value.trim()) orgs.value = res.list;
  } catch {
    orgs.value = [];
  } finally {
    loading.value = false;
  }
}, 220);

watch(keyword, (v) => {
  activeIndex.value = 0;
  loading.value = !!v.trim() && auth.can(PERM.ORG_VIEW);
  searchOrgs(v.trim());
});

watch(show, async (v) => {
  if (v) {
    keyword.value = '';
    orgs.value = [];
    activeIndex.value = 0;
    await nextTick();
    inputRef.value?.focus();
  }
});

function go(item?: ResultItem) {
  if (!item) return;
  show.value = false;
  router.push(item.to);
}

function onKeydown(e: KeyboardEvent) {
  const len = results.value.length;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeIndex.value = len ? (activeIndex.value + 1) % len : 0;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeIndex.value = len ? (activeIndex.value - 1 + len) % len : 0;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    go(results.value[activeIndex.value]);
  }
}
</script>

<template>
  <NModal v-model:show="show" :auto-focus="false" transform-origin="center">
    <div class="palette" role="dialog" aria-label="全局搜索">
      <div class="palette-input">
        <Search :size="18" :stroke-width="1.75" class="text-3" />
        <input
          id="global-search-input"
          ref="inputRef"
          v-model="keyword"
          placeholder="搜索页面、机构名称、城市、联系人..."
          autocomplete="off"
          @keydown="onKeydown"
        />
        <kbd>Esc</kbd>
      </div>

      <div class="palette-body">
        <template v-for="[group, list] in groups" :key="group">
          <div class="group-title">{{ group }}</div>
          <button
            v-for="{ item, index } in list"
            :id="`search-result-${item.id}`"
            :key="item.id"
            class="result"
            :class="{ active: index === activeIndex }"
            @mouseenter="activeIndex = index"
            @click="go(item)"
          >
            <component :is="item.icon" :size="16" :stroke-width="1.75" class="result-icon" />
            <span class="result-label ellipsis">{{ item.label }}</span>
            <span v-if="item.sub" class="result-sub">{{ item.sub }}</span>
            <CornerDownLeft v-if="index === activeIndex" :size="14" class="result-enter" />
          </button>
        </template>
        <div v-if="loading" class="palette-empty">搜索中...</div>
        <div v-else-if="!results.length" class="palette-empty">没有匹配的结果</div>
      </div>

      <div class="palette-foot">
        <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
        <span><kbd>Enter</kbd> 打开</span>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.palette {
  width: min(600px, calc(100vw - 32px));
  margin-top: -12vh;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-pop);
  overflow: hidden;
}
.palette-input {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  height: 54px;
  border-bottom: 1px solid var(--border);
}
.palette-input input {
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font: inherit;
  font-size: 15px;
  color: var(--text);
}
.palette-input input::placeholder {
  color: var(--text-3);
}
kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  margin: 0 2px;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 4px;
  font-family: var(--font-sans);
  font-size: 11px;
  color: var(--text-3);
  background: var(--bg-subtle);
}
.palette-body {
  max-height: 380px;
  overflow-y: auto;
  padding: 6px;
}
.group-title {
  padding: 10px 10px 6px;
  font-size: 12px;
  color: var(--text-3);
}
.result {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 40px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  text-align: left;
}
.result.active {
  background: var(--brand-soft);
}
.result.active .result-icon {
  color: var(--brand);
}
.result-icon {
  color: var(--text-3);
  flex-shrink: 0;
}
.result-label {
  flex: 1;
  min-width: 0;
}
.result-sub {
  font-size: 12px;
  color: var(--text-3);
  flex-shrink: 0;
}
.result-enter {
  color: var(--text-3);
  flex-shrink: 0;
}
.palette-empty {
  padding: 28px 0;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
.palette-foot {
  display: flex;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-3);
  background: var(--bg-subtle);
}
</style>
