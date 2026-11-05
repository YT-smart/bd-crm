<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import {
  NForm, NFormItem, NInput, NSelect, NDynamicTags, useMessage,
  type SelectOption, type SelectGroupOption,
} from 'naive-ui';
import { Save } from 'lucide-vue-next';
import {
  BUSINESS_TYPES, COUNTRY_GROUPS, PROVINCES, ORG_LEVELS, CITIES_BY_PROVINCE, PROVINCE_OF_CITY,
  shortProvinceName, type OrgDetail, type Province,
} from '@bdcrm/shared';
import { orgApi } from '@/api';
import { ApiError } from '@/api/http';
import { useAuthStore } from '@/stores/auth';
import WechatQr from '@/components/WechatQr.vue';

const props = withDefaults(defineProps<{ org: OrgDetail; canEdit?: boolean }>(), { canEdit: true });
/** qrChanged：二维码是即时上传的，不随表单保存，由父组件在关闭抽屉后刷新 */
const emit = defineEmits<{ updated: []; qrChanged: [] }>();
const message = useMessage();
const saving = ref(false);
/** 机构账号不能改名称、等级、标签（内部字段） */
const isOrgUser = computed(() => useAuthStore().user?.role === 'ORG');

const form = reactive({
  name: '',
  advantage: '',
  intro: '',
  province: null as string | null,
  city: null as string | null,
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

/** resetForm 期间不触发总部城市联动 */
let resetting = false;

function resetForm() {
  resetting = true;
  form.name = props.org.name;
  form.advantage = props.org.advantage ?? '';
  form.intro = props.org.intro ?? '';
  form.province = props.org.province;
  form.city = props.org.city || null;
  form.address = props.org.address ?? '';
  form.website = props.org.website ?? '';
  form.wechat = props.org.wechat ?? '';
  form.scale = props.org.scale ?? '';
  form.businessTypes = [...props.org.businessTypes];
  form.countries = [...props.org.countries];
  form.officeCities = [...props.org.officeCities];
  form.tags = [...props.org.tags];
  form.level = props.org.level;
  queueMicrotask(() => (resetting = false));
}

watch(() => props.org, resetForm, { immediate: true });

const provinceOptions = PROVINCES.map((p) => ({ label: shortProvinceName(p), value: p }));
const businessTypeOptions = BUSINESS_TYPES.map((t) => ({ label: t, value: t }));
const countryOptions: SelectGroupOption[] = COUNTRY_GROUPS.map((g) => ({
  type: 'group',
  key: g.label,
  label: g.label,
  children: g.items.map((c) => ({ label: c, value: c })),
}));
const levelOptions = ORG_LEVELS.map((l) => ({ label: `${l} 级`, value: l }));

/** 全部城市按省份分组 */
const groupedCityOptions: SelectGroupOption[] = PROVINCES.map((p) => ({
  type: 'group',
  key: p,
  label: shortProvinceName(p),
  children: CITIES_BY_PROVINCE[p].map((c) => ({ label: c, value: c })),
}));

/** 总部城市：选了省份只列该省城市，否则列全部 */
const hqCityOptions = computed<(SelectOption | SelectGroupOption)[]>(() =>
  form.province
    ? CITIES_BY_PROVINCE[form.province as Province].map((c) => ({ label: c, value: c }))
    : groupedCityOptions,
);

// 切换省份时，清空不属于该省的总部城市
watch(() => form.province, (p) => {
  if (form.city && p && PROVINCE_OF_CITY[form.city] !== p) form.city = null;
});

// 选择总部城市：自动带出省份，并同步到办公城市（改选时替换掉之前的总部城市，而不是累加）
watch(() => form.city, (c, old) => {
  if (resetting) return;
  let offices = form.officeCities;
  if (old && old !== c) offices = offices.filter((x) => x !== old);
  if (c) {
    const p = PROVINCE_OF_CITY[c];
    if (p && form.province !== p) form.province = p;
    offices = [c, ...offices.filter((x) => x !== c)];
  }
  form.officeCities = offices;
});

const isDirty = computed(() => {
  const o = props.org;
  return (
    form.name !== o.name ||
    form.advantage !== (o.advantage ?? '') ||
    form.intro !== (o.intro ?? '') ||
    form.province !== o.province ||
    (form.city ?? '') !== (o.city ?? '') ||
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
      advantage: form.advantage.trim() || null,
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
    <NForm label-placement="left" label-width="120" :show-feedback="false" :disabled="!canEdit">
      <div class="form-grid">
        <NFormItem label="机构名称" required>
          <NInput v-model:value="form.name" placeholder="机构名称" maxlength="100" :disabled="isOrgUser || !canEdit" />
        </NFormItem>
        <NFormItem label="所在省份">
          <NSelect v-model:value="form.province" :options="provinceOptions" clearable filterable placeholder="选择省份" />
        </NFormItem>
        <NFormItem label="总部城市">
          <NSelect
            id="org-info-city"
            v-model:value="form.city"
            :options="hqCityOptions"
            clearable
            filterable
            placeholder="选择总部城市"
          />
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
        <NFormItem label="公众号二维码" class="full">
          <WechatQr :org-id="org.id" :has="org.hasWechatQr" :can-edit="canEdit" :size="88" @changed="emit('qrChanged')" />
        </NFormItem>
        <NFormItem label="业务类型" class="full">
          <NSelect
            v-model:value="form.businessTypes"
            :options="businessTypeOptions"
            multiple
            placeholder="选择业务类型"
          />
        </NFormItem>
        <NFormItem label="覆盖国家和地区" class="full">
          <NSelect
            v-model:value="form.countries"
            :options="countryOptions"
            multiple
            filterable
            placeholder="选择覆盖国家和地区（可搜索）"
          />
        </NFormItem>
        <NFormItem label="办公城市" class="full">
          <NSelect
            id="org-info-office-cities"
            v-model:value="form.officeCities"
            :options="groupedCityOptions"
            multiple
            filterable
            :max-tag-count="12"
            placeholder="选择办公城市（总部城市会自动加入）"
          />
        </NFormItem>
        <NFormItem v-if="!isOrgUser" label="标签" class="full">
          <NDynamicTags v-model:value="form.tags" :max="10" :disabled="!canEdit" />
        </NFormItem>
        <NFormItem label="机构优势" class="full">
          <NInput
            id="org-info-advantage"
            v-model:value="form.advantage"
            placeholder="一句话介绍机构优势，如：专注英港新硕士申请，名校录取率行业领先"
            maxlength="100"
            show-count
          />
        </NFormItem>
        <NFormItem label="机构简介" class="full">
          <NInput v-model:value="form.intro" type="textarea" placeholder="机构简介" :autosize="{ minRows: 3, maxRows: 6 }" maxlength="2000" show-count />
        </NFormItem>
      </div>
    </NForm>

    <div v-if="canEdit" class="actions">
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
  gap: 0 24px;
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
