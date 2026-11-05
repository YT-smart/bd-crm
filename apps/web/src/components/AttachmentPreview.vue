<script setup lang="ts">
import { NModal } from 'naive-ui';
import AttachmentViewer from './AttachmentViewer.vue';

/** 附件预览弹窗（内容渲染见 AttachmentViewer） */
defineProps<{ show: boolean; name: string; url: string; downloadUrl: string }>();
const emit = defineEmits<{ 'update:show': [v: boolean] }>();
defineSlots<{ actions?: () => unknown }>();
</script>

<template>
  <NModal :show="show" @update:show="(v) => emit('update:show', v)">
    <AttachmentViewer :name="name" :url="url" :download-url="downloadUrl" @close="emit('update:show', false)">
      <template #actions><slot name="actions" /></template>
    </AttachmentViewer>
  </NModal>
</template>
