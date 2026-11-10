<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import {
  NForm, NFormItem, NInput, NSelect, NDynamicTags, useMessage,
  type SelectOption, type SelectGroupOption,
} from 'naive-ui';
import { Save } from 'lucide-vue-next';
import {
  BUSINESS_TYPES, BUSINESS_TYPE_MAX_LEN, COUNTRY_GROUPS, PROVINCES, ORG_LEVELS, CITIES_BY_PROVINCE, PROVINCE_OF_CITY,
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

/** 业务类型下拉里的「其他（自定义）」 */
const OTHER = '__other__';
/** 勾选「其他」时填写的自定义业务类型 */
const customType = ref('');

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
  customType.value = '';
  form.countries = [...props.org.countries];
  form.officeCities = [...props.org.officeCities];
  form.tags = [...props.org.tags];
  form.level = props.org.level;
  queueMicrotask(() => (resetting = false));
}

watch(() => props.org, resetForm, { immediate: true });

const provinceOptions = PROVINCES.map((p) => ({ label: shortProvinceName(p), value: p }));
/** 常用业务类型 + 机构已有的自定义类型；也可以直接输入新的类型 */
const businessTypeOptions = computed(() => [
  ...[...new Set([...BUSINESS_TYPES, ...props.org.businessTypes, ...form.businessTypes])]
    .filter((t) => t !== OTHER)
    .map((t) => ({ label: t, value: t })),
  { label: '其他（自定义）', value: OTHER },
]);
/** 提交用的业务类型：把「其他」换成填写的内容 */
function finalBusinessTypes() {
  const list = form.businessTypes.filter((t) => t !== OTHER);
  const c = customType.value.trim();
  if (form.businessTypes.includes(OTHER) && c && !list.includes(c)) list.push(c);
  return list;
}
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

// 选择总部城市：自动带出省份，并同步到校区城市（改选时替换掉之前的总部城市，而不是累加）
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
    // 勾了「其他」也算改动，这样点保存时能提示去填写
    form.businessTypes.includes(OTHER) ||
    JSON.stringify(finalBusinessTypes()) !== JSON.stringify(o.businessTypes) ||
    JSON.stringify(form.countries) !== JSON.stringify(o.countries) ||
    JSON.stringify(form.officeCities) !== JSON.stringify(o.officeCities) ||
    JSON.stringify(form.tags) !== JSON.stringify(o.tags)
  );
});

/** 基本信息必须全部填写（等级、标签是内部字段，二维码单独上传，不在此列） */
function missingFields(): string[] {
  const blank = (v: string | null) => !v || !v.trim();
  const miss: string[] = [];
  if (blank(form.name)) miss.push('机构名称');
  if (!form.province) miss.push('所在省份');
  if (!form.city) miss.push('总部城市');
  if (blank(form.address)) miss.push('详细地址');
  if (blank(form.scale)) miss.push('机构规模');
  if (blank(form.website)) miss.push('官网');
  if (blank(form.wechat)) miss.push('公众号');
  if (!finalBusinessTypes().length) miss.push('业务类型');
  if (!form.countries.length) miss.push('覆盖国家和地区');
  if (!form.officeCities.length) miss.push('校区城市');
  if (blank(form.advantage)) miss.push('机构一句话优势');
  if (blank(form.intro)) miss.push('机构简介');
  return miss;
}

async function save() {
  if (form.businessTypes.includes(OTHER) && !customType.value.trim()) {
    message.warning('选择了「其他」，请填写自定义的业务类型');
    return;
  }
  const miss = missingFields();
  if (miss.length) {
    message.warning(`请把信息填写完整：${miss.join('、')}`);
    return;
  }
  if (!/^https?:\/\//i.test(form.website.trim())) {
    message.warning('官网需以 http:// 或 https:// 开头');
    return;
  }
  saving.value = true;
  try {
    await orgApi.update(props.org.id, {
      ...(isOrgUser.value ? {} : { name: form.name, tags: form.tags, level: form.level }),
      advantage: form.advantage.trim(),
      intro: form.intro.trim(),
      province: form.province,
      city: form.city,
      address: form.address.trim(),
      website: form.website.trim(),
      wechat: form.wechat.trim(),
      scale: form.scale.trim(),
      businessTypes: finalBusinessTypes(),
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
        <NFormItem label="所在省份" required>
          <NSelect v-model:value="form.province" :options="provinceOptions" clearable filterable placeholder="选择省份" />
        </NFormItem>
        <NFormItem label="总部城市" required>
          <NSelect
            id="org-info-city"
            v-model:value="form.city"
            :options="hqCityOptions"
            clearable
            filterable
            placeholder="选择总部城市"
          />
        </NFormItem>
        <NFormItem label="详细地址" required>
          <NInput v-model:value="form.address" placeholder="详细地址" maxlength="200" />
        </NFormItem>
        <NFormItem v-if="!isOrgUser" label="机构等级">
          <NSelect v-model:value="form.level" :options="levelOptions" clearable placeholder="等级" />
        </NFormItem>
        <NFormItem label="机构规模" required>
          <NInput v-model:value="form.scale" placeholder="如: 50-100人" maxlength="50" />
        </NFormItem>
        <NFormItem label="官网" required>
          <NInput v-model:value="form.website" placeholder="https://..." maxlength="200" />
        </NFormItem>
        <NFormItem label="公众号" required>
          <NInput v-model:value="form.wechat" placeholder="微信公众号名称" maxlength="100" />
        </NFormItem>
        <NFormItem label="公众号二维码" class="full">
          <WechatQr :org-id="org.id" :has="org.hasWechatQr" :can-edit="canEdit" :size="88" @changed="emit('qrChanged')" />
        </NFormItem>
        <NFormItem label="业务类型" class="full" required>
          <NSelect
            v-model:value="form.businessTypes"
            :options="businessTypeOptions"
            multiple
            :max-tag-count="12"
            placeholder="选择业务类型（留学、语培、竞赛…），没有的选「其他」自己填写"
          />
        </NFormItem>
        <NFormItem v-if="form.businessTypes.includes(OTHER)" label="其他业务类型" class="full">
          <NInput
            id="org-custom-type"
            v-model:value="customType"
            :maxlength="BUSINESS_TYPE_MAX_LEN"
            placeholder="填写业务类型，如：夏令营、艺术留学"
          />
        </NFormItem>
        <NFormItem label="覆盖国家和地区" class="full" required>
          <NSelect
            v-model:value="form.countries"
            :options="countryOptions"
            multiple
            filterable
            placeholder="选择覆盖国家和地区（可搜索）"
          />
        </NFormItem>
        <NFormItem label="校区城市" class="full" required>
          <NSelect
            id="org-info-office-cities"
            v-model:value="form.officeCities"
            :options="groupedCityOptions"
            multiple
            filterable
            :max-tag-count="12"
            placeholder="选择校区城市（总部城市会自动加入）"
          />
        </NFormItem>
        <NFormItem v-if="!isOrgUser" label="标签" class="full">
          <NDynamicTags v-model:value="form.tags" :max="10" :disabled="!canEdit" />
        </NFormItem>
        <NFormItem label="机构一句话优势" class="full" required>
          <NInput
            id="org-info-advantage"
            v-model:value="form.advantage"
            placeholder="一句话介绍机构的优势，如：专注英港新硕士申请，名校录取率行业领先"
            maxlength="100"
            show-count
          />
        </NFormItem>
        <NFormItem label="机构简介" class="full" required>
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
