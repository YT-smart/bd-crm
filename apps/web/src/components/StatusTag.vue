<script setup lang="ts">
import { computed } from 'vue';
import { DEAL_STATUS_LABEL, ORG_STATUS_LABEL, type DealStatus, type OrgStatus } from '@bdcrm/shared';

const props = defineProps<
  { kind: 'deal'; status: DealStatus } | { kind: 'org'; status: OrgStatus }
>();

const DEAL_TONE: Record<DealStatus, string> = {
  PENDING_AUDIT: 'brand',
  REJECTED: 'danger',
  PENDING_PAYMENT: 'warning',
  SETTLED: 'success',
};
const ORG_TONE: Record<OrgStatus, string> = {
  NEGOTIATING: 'info',
  ACTIVE: 'success',
  PAUSED: 'warning',
  TERMINATED: 'neutral',
};

const view = computed(() =>
  props.kind === 'deal'
    ? { label: DEAL_STATUS_LABEL[props.status], tone: DEAL_TONE[props.status] }
    : { label: ORG_STATUS_LABEL[props.status], tone: ORG_TONE[props.status] },
);
</script>

<template>
  <span class="pill" :class="`pill-${view.tone}`">{{ view.label }}</span>
</template>
