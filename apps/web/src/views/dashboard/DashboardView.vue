<script setup lang="ts">
import { PERM } from '@bdcrm/shared';
import { useAuthStore } from '@/stores/auth';
import GlobalDashboard from './GlobalDashboard.vue';
import OrgDashboard from './OrgDashboard.vue';

const auth = useAuthStore();
</script>

<template>
  <GlobalDashboard v-if="auth.can(PERM.DASHBOARD_GLOBAL)" />
  <OrgDashboard v-else />
</template>
