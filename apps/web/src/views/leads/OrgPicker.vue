<script setup lang="ts">
import { ref, watch } from 'vue';
import { NSelect } from 'naive-ui';
import { useDebounceFn } from '@vueuse/core';
import { orgApi } from '@/api';

/** 机构下拉：机构很多，按名字远程搜索 */
const props = defineProps<{ label?: string | null; placeholder?: string }>();
const value = defineModel<string | null>('value', { required: true });

const options = ref<{ label: string; value: string }[]>([]);
const loading = ref(false);

watch(
  () => [value.value, props.label] as const,
  ([v, l]) => {
    if (v && l && !options.value.some((o) => o.value === v)) options.value = [{ label: l, value: v }, ...options.value];
  },
  { immediate: true },
);

async function search(keyword: string) {
  loading.value = true;
  try {
    const res = await orgApi.list({ keyword: keyword || undefined, pageSize: 20, page: 1 });
    const cur = options.value.find((o) => o.value === value.value);
    const list = res.list.map((o) => ({ label: o.name, value: o.id }));
    options.value = cur && !list.some((o) => o.value === cur.value) ? [cur, ...list] : list;
  } catch {
    /* 搜索失败保持原选项 */
  } finally {
    loading.value = false;
  }
}
const onSearch = useDebounceFn(search, 250);
</script>

<template>
  <NSelect
    v-model:value="value"
    :options="options"
    :loading="loading"
    filterable
    remote
    clearable
    :placeholder="placeholder ?? '搜索机构名称'"
    @search="onSearch"
    @focus="!options.length && search('')"
  />
</template>
