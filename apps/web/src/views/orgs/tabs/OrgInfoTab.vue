<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import {
  NForm, NFormItem, NInput, NSelect, NInputNumber,
  NDatePicker, NDynamicTags, useMessage,
} from 'naive-ui';
import { Save } from 'lucide-vue-next';
import {
  BUSINESS_TYPES, COUNTRIES, PROVINCES, ORG_LEVELS,
  shortProvinceName, type OrgDetail,
} from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{ org: OrgDetail }>();
const emit = defineEmits<{ updated: [] }>();
const message = useMessage();
const saving = ref(false);
/** 机构账号不能改名称、等级、标签（内部字段） */
const isOrgUser = computed(() => useAuthStore().user?.role === 'ORG');

const form = reactive({
  name: '',
  intro: '',
  province: null as string | null,
  city: '',
  address: '',
  website: '',
  wechat: '',
  scale: '',
  businessTypes: [] as string[],
  countries: [] as string[],
  officeCities: [] as string[],
  tags: [] as string[],
  level: null as string | null,
});

function resetForm() {
  form.name = props.org.name;
  form.intro = props.org.intro ?? '';
  form.province = props.org.province;
  form.city = props.org.city ?? '';
  form.address = props.org.address ?? '';
  form.website = props.org.website ?? '';
  form.wechat = props.org.wechat ?? '';
  form.scale = props.org.scale ?? '';
  form.businessTypes = [...props.org.businessTypes];
  form.countries = [...props.org.countries];
  form.officeCities = [...props.org.officeCities];
  form.tags = [...props.org.tags];
  form.level = props.org.level;
}

watch(() => props.org, resetForm, { immediate: true });

const provinceOptions = PROVINCES.map((p) => ({ label: shortProvinceName(p), value: p }));
const businessTypeOptions = BUSINESS_TYPES.map((t) => ({ label: t, value: t }));
const countryOptions = COUNTRIES.map((c) => ({ label: c, value: c }));
const levelOptions = ORG_LEVELS.map((l) => ({ label: `${l} 级`, value: l }));

const isDirty = computed(() => {
  const o = props.org;
  return (
    form.name !== o.name ||
    form.intro !== (o.intro ?? '') ||
    form.province !== o.province ||
    form.city !== (o.city ?? '') ||
    form.address !== (o.address ?? '') ||
    form.website !== (o.website ?? '') ||
    form.wechat !== (o.wechat ?? '') ||
    form.scale !== (o.scale ?? '') ||
    form.level !== o.level ||
    JSON.stringify(form.businessTypes) !== JSON.stringify(o.businessTypes) ||
    JSON.stringify(form.countries) !== JSON.stringify(o.countries) ||
    JSON.stringify(form.officeCities) !== JSON.stringify(o.officeCities) ||
    JSON.stringify(form.tags) !== JSON.stringify(o.tags)
  );
});

async function save() {
  if (!form.name.trim()) {
    message.warning('机构名称不能为空');
    return;
  }
  saving.value = true;
  try {
    await orgApi.update(props.org.id, {
      ...(isOrgUser.value ? {} : { name: form.name, tags: form.tags, level: form.level }),
      intro: form.intro || null,
      province: form.province,
      city: form.city || null,
      address: form.address || null,
      website: form.website || null,
      wechat: form.wechat || null,
      scale: form.scale || null,
      businessTypes: form.businessTypes,
      countries: form.countries,
      officeCities: form.officeCities,
    });
    message.success('已保存');
    emit('updated');
  } catch (e) {
    message.error(e instanceof ApiError ? e.message : '保存失败');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="info-tab">
    <NForm label-placement="left" label-width="90" :show-feedback="false">
      <div class="form-grid">
        <NFormItem label="机构名称" required>
          <NInput v-model:value="form.name" placeholder="机构名称" maxlength="100" :disabled="isOrgUser" />
        </NFormItem>
        <NFormItem label="所在省份">
          <NSelect v-model:value="form.province" :options="provinceOptions" clearable filterable placeholder="选择省份" />
        </NFormItem>
        <NFormItem label="所在城市">
          <NInput v-model:value="form.city" placeholder="城市" maxlength="50" />
        </NFormItem>
        <NFormItem label="详细地址">
          <NInput v-model:value="form.address" placeholder="详细地址" maxlength="200" />
        </NFormItem>
        <NFormItem v-if="!isOrgUser" label="机构等级">
          <NSelect v-model:value="form.level" :options="levelOptions" clearable placeholder="等级" />
        </NFormItem>
        <NFormItem label="机构规模">
          <NInput v-model:value="form.scale" placeholder="如: 50-100人" maxlength="50" />
        </NFormItem>
        <NFormItem label="官网">
          <NInput v-model:value="form.website" placeholder="https://..." maxlength="200" />
        </NFormItem>
        <NFormItem label="公众号">
          <NInput v-model:value="form.wechat" placeholder="微信公众号名称" maxlength="100" />
        </NFormItem>
        <NFormItem label="业务类型" class="full">
          <NSelect
            v-model:value="form.businessTypes"
            :options="businessTypeOptions"
            multiple
            placeholder="选择业务类型"
          />
        </NFormItem>
        <NFormItem label="覆盖国家" class="full">
          <NSelect
            v-model:value="form.countries"
            :options="countryOptions"
            multiple
            filterable
            placeholder="选择覆盖国家"
          />
        </NFormItem>
        <NFormItem label="办公城市" class="full">
          <NDynamicTags v-model:value="form.officeCities" />
        </NFormItem>
        <NFormItem v-if="!isOrgUser" label="标签" class="full">
          <NDynamicTags v-model:value="form.tags" :max="10" />
        </NFormItem>
        <NFormItem label="机构简介" class="full">
          <NInput v-model:value="form.intro" type="textarea" placeholder="机构简介" :autosize="{ minRows: 3, maxRows: 6 }" maxlength="2000" show-count />
        </NFormItem>
      </div>
    </NForm>

    <div class="actions">
      <button class="btn" :disabled="!isDirty || saving" @click="save">
        <Save :size="14" /> {{ saving ? '保存中...' : '保存' }}
      </button>
      <button v-if="isDirty" class="btn btn-ghost" @click="resetForm">重置</button>
    </div>
  </div>
</template>

<style scoped>
.info-tab {
  max-width: 800px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 24px;
}
.form-grid :deep(.full) {
  grid-column: 1 / -1;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
</style>
