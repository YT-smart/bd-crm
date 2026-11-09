<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NDrawer, NDrawerContent } from 'naive-ui';
import type { OrgDetail } from '@bdcrm/shared';
import OrgBasicInfo from './tabs/OrgBasicInfo.vue';
import OrgInfoTab from './tabs/OrgInfoTab.vue';
import OrgContactsTab from './tabs/OrgContactsTab.vue';
import OrgProductsTab from './tabs/OrgProductsTab.vue';
import OrgCooperationTab from './tabs/OrgCooperationTab.vue';
import OrgStatsCard from './tabs/OrgStatsCard.vue';
import OrgDealsTab from './tabs/OrgDealsTab.vue';
import OrgFollowUpsTab from './tabs/OrgFollowUpsTab.vue';
import OrgAttachmentsTab from './tabs/OrgAttachmentsTab.vue';
import OrgReviewsCard from './tabs/OrgReviewsCard.vue';
import { PERM } from '@bdcrm/shared';
import { useAuthStore } from '@/stores/auth';

/**
 * 机构完整资料：卡片式分块，左侧主信息、右侧联系方式与合作数据，所有信息一屏内纵向浏览。
 * 合作信息、跟进记录、标签属于内部字段，机构账号不展示。
 */
const props = withDefaults(
  defineProps<{ org: OrgDetail; canEdit?: boolean; internal?: boolean }>(),
  { canEdit: true, internal: true },
);
const emit = defineEmits<{ refresh: [] }>();
const auth = useAuthStore();
/** 合作信息（结算、合同、收款账户）只给管理员看；评价员工和管理员都能看能写 */
const canSeeCooperation = auth.can(PERM.ORG_COOPERATION);
/** 跟钱有关的（佣金比例、成交记录、合作数据）：管理员；机构账号看自己的 */
const canSeeMoney = computed(() => !props.internal || canSeeCooperation);
const canReview = auth.can(PERM.ORG_REVIEW);

const showEdit = ref(false);
function openEdit() {
  showEdit.value = true;
}
function onInfoUpdated() {
  qrDirty = false;
  showEdit.value = false;
  emit('refresh');
}
/** 抽屉里上传 / 删除了二维码：关闭时刷新详情（打开期间刷新会覆盖未保存的表单） */
let qrDirty = false;
watch(showEdit, (open) => {
  if (!open && qrDirty) {
    qrDirty = false;
    emit('refresh');
  }
});

defineExpose({ openEdit });
</script>

<template>
  <div class="profile">
    <div class="col-main">
      <OrgBasicInfo :org="org" :can-edit="canEdit" :internal="internal" :show-rate="canSeeMoney" @edit="openEdit" />
      <OrgProductsTab
        :org-id="org.id"
        :products="org.products"
        :default-rate="org.defaultRate"
        :show-rate="canSeeMoney"
        :can-edit="canEdit"
        @refresh="emit('refresh')"
      />
      <OrgDealsTab v-if="canSeeMoney" :org-id="org.id" />
      <OrgAttachmentsTab :org-id="org.id" :can-edit="canEdit" />
    </div>

    <div class="col-side">
      <OrgContactsTab
        :org-id="org.id"
        :contacts="org.contacts"
        :can-edit="canEdit"
        :website="org.website"
        :wechat="org.wechat"
        :address="org.address"
        :has-wechat-qr="org.hasWechatQr"
        @refresh="emit('refresh')"
      />
      <OrgStatsCard v-if="canSeeMoney" :stats="org.stats" />
      <OrgReviewsCard v-if="internal && canReview" :org-id="org.id" />
      <OrgCooperationTab v-if="internal && canSeeCooperation" :org="org" :can-edit="canEdit" @updated="emit('refresh')" />
      <OrgFollowUpsTab v-if="internal" :org-id="org.id" :can-edit="canEdit" />
    </div>

    <NDrawer v-model:show="showEdit" :width="760" :auto-focus="false">
      <NDrawerContent title="编辑基本信息" closable>
        <OrgInfoTab :org="org" :can-edit="canEdit" @updated="onInfoUpdated" @qr-changed="qrDirty = true" />
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<style scoped>
.profile {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 16px;
  align-items: start;
  margin-top: 16px;
}
.col-main,
.col-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
@media (max-width: 1180px) {
  .profile {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
