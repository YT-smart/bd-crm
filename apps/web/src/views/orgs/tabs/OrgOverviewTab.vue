<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { NSkeleton } from 'naive-ui';
import { ChevronRight, Download, Eye, FileText, Paperclip, Package, Sparkles } from 'lucide-vue-next';
import { ATTACHMENT_CATEGORY_LABEL, type AttachmentCategory, type OrgAttachmentItem, type OrgDetail } from '@bdcrm/shared';
import { orgApi } from '@/api';
import { money, date } from '@/utils/format';

const props = defineProps<{ org: OrgDetail }>();
const emit = defineEmits<{ refresh: []; navigate: [tab: string] }>();

/* ---------- 附件 ---------- */
const attachments = ref<OrgAttachmentItem[]>([]);
const attLoading = ref(true);
async function loadAttachments() {
  attLoading.value = true;
  try {
    attachments.value = await orgApi.attachments(props.org.id);
  } catch {
    attachments.value = [];
  } finally {
    attLoading.value = false;
  }
}
onMounted(loadAttachments);
watch(() => props.org.updatedAt, loadAttachments);

const ATT_LIMIT = 6;
const attShown = computed(() => attachments.value.slice(0, ATT_LIMIT));
const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const canPreview = (a: OrgAttachmentItem) => /^(jpg|jpeg|png|webp|gif|pdf|txt)$/.test(ext(a.name));
const attUrl = (a: OrgAttachmentItem, inline = false) => orgApi.attachmentUrl(props.org.id, a.id, inline);

/* ---------- 产品 ---------- */
function priceText(p: OrgDetail['products'][number]) {
  if (p.priceMin == null && p.priceMax == null) return '--';
  if (p.priceMin != null && p.priceMax != null && p.priceMin === p.priceMax) return money(p.priceMin);
  return `${p.priceMin != null ? money(p.priceMin) : '--'} ~ ${p.priceMax != null ? money(p.priceMax) : '--'}`;
}

const region = computed(() => [props.org.province, props.org.city].filter(Boolean).join(' · ') || '--');
</script>

<template>
  <div class="overview">
    <!-- 机构优势 -->
    <div v-if="org.advantage" class="advantage">
      <Sparkles :size="16" :stroke-width="1.75" />
      <span>{{ org.advantage }}</span>
    </div>

    <!-- 基本信息 -->
    <section class="info-section">
      <h3 class="section-title">基本信息</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">机构名称</span>
          <span class="info-value">{{ org.name }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">总部城市</span>
          <span class="info-value">{{ region }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">办公城市</span>
          <span class="info-value">
            <template v-if="org.officeCities.length">
              <span v-for="c in org.officeCities" :key="c" class="chip">{{ c }}</span>
            </template>
            <template v-else>--</template>
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">默认佣金比例</span>
          <span class="info-value num">{{ org.defaultRate }}%</span>
        </div>
        <div class="info-item">
          <span class="info-label">业务类型</span>
          <span class="info-value">{{ org.businessTypes.join('、') || '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">覆盖国家</span>
          <span class="info-value">{{ org.countries.join('、') || '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">机构规模</span>
          <span class="info-value">{{ org.scale || '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">官网</span>
          <a v-if="org.website" class="info-value link" :href="org.website" target="_blank" rel="noopener noreferrer">{{ org.website }}</a>
          <span v-else class="info-value">--</span>
        </div>
        <div class="info-item">
          <span class="info-label">详细地址</span>
          <span class="info-value">{{ org.address || '--' }}</span>
        </div>
        <div v-if="org.intro" class="info-item full">
          <span class="info-label">机构简介</span>
          <span class="info-value intro">{{ org.intro }}</span>
        </div>
      </div>
    </section>

    <!-- 联系人 -->
    <section v-if="org.contacts.length" class="info-section">
      <div class="section-head">
        <h3 class="section-title">联系人</h3>
        <button class="link-btn more" @click="emit('navigate', 'contacts')">
          全部 {{ org.contacts.length }} 位 <ChevronRight :size="14" />
        </button>
      </div>
      <div class="contacts-snap">
        <div v-for="c in org.contacts.slice(0, 4)" :key="c.id" class="contact-chip">
          <div class="contact-name">
            {{ c.name }}
            <span v-if="c.isPrimary" class="primary-badge">主要</span>
          </div>
          <div class="contact-meta text-3">
            {{ [c.title, c.phone, c.wechat && `微信 ${c.wechat}`].filter(Boolean).join(' · ') || '--' }}
          </div>
        </div>
      </div>
    </section>

    <!-- 产品与报价 -->
    <section class="info-section">
      <div class="section-head">
        <h3 class="section-title">产品与报价</h3>
        <button v-if="org.products.length" class="link-btn more" @click="emit('navigate', 'products')">
          管理 <ChevronRight :size="14" />
        </button>
      </div>
      <div v-if="!org.products.length" class="empty-line text-3">
        <Package :size="15" :stroke-width="1.75" /> 暂未添加产品与报价
      </div>
      <div v-else class="table-wrap">
        <table class="mini-table">
          <thead>
            <tr>
              <th>产品名称</th>
              <th>业务类型</th>
              <th class="r">报价区间</th>
              <th class="r">佣金比例</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in org.products" :key="p.id">
              <td class="strong">{{ p.name }}</td>
              <td><span class="type-tag">{{ p.type }}</span></td>
              <td class="r num">{{ priceText(p) }}</td>
              <td class="r num">
                <span v-if="p.rate != null" class="rate">{{ p.rate }}%</span>
                <span v-else>{{ org.defaultRate }}%<span class="text-3 small">（默认）</span></span>
              </td>
              <td class="note">{{ p.note ? `备注：${p.note}` : '--' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 附件资料 -->
    <section class="info-section">
      <div class="section-head">
        <h3 class="section-title">附件资料</h3>
        <button v-if="attachments.length" class="link-btn more" @click="emit('navigate', 'attachments')">
          全部 {{ attachments.length }} 个 <ChevronRight :size="14" />
        </button>
      </div>
      <div v-if="attLoading" class="att-grid">
        <NSkeleton v-for="i in 3" :key="i" :height="52" :sharp="false" />
      </div>
      <div v-else-if="!attachments.length" class="empty-line text-3">
        <Paperclip :size="15" :stroke-width="1.75" /> 暂未上传附件资料
      </div>
      <div v-else class="att-grid">
        <div v-for="a in attShown" :key="a.id" class="att-item">
          <FileText :size="18" :stroke-width="1.6" class="att-icon" />
          <div class="att-body">
            <div class="att-name" :title="a.name">{{ a.name }}</div>
            <div class="att-meta text-3">{{ ATTACHMENT_CATEGORY_LABEL[a.category as AttachmentCategory] }} · {{ date(a.createdAt) }}</div>
          </div>
          <a v-if="canPreview(a)" class="icon-btn" :href="attUrl(a, true)" target="_blank" rel="noopener" title="预览">
            <Eye :size="14" />
          </a>
          <a class="icon-btn" :href="attUrl(a)" title="下载"><Download :size="14" /></a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.advantage {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--brand-soft), transparent);
  border: 1px solid var(--brand-soft);
  color: var(--brand);
  font-size: 14px;
  font-weight: 500;
}
.advantage span { color: var(--text); }
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.section-head .section-title { margin: 0; }
.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 12px;
}
.more {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px 24px;
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.info-item.full {
  grid-column: 1 / -1;
}
.info-label {
  font-size: 12px;
  color: var(--text-3);
}
.info-value {
  font-size: 14px;
  color: var(--text);
  line-height: 1.5;
  word-break: break-all;
}
.info-value.intro { white-space: pre-wrap; }
.info-value.link { color: var(--brand); text-decoration: none; }
.info-value.link:hover { text-decoration: underline; }
.chip {
  display: inline-block;
  font-size: 12px;
  padding: 1px 8px;
  margin: 0 6px 4px 0;
  border-radius: 99px;
  background: var(--neutral-soft);
  color: var(--text-2);
}
.contacts-snap {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.contact-chip {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  min-width: 0;
}
.contact-name {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}
.primary-badge {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 99px;
  background: var(--brand-soft);
  color: var(--brand);
  font-weight: 600;
}
.contact-meta {
  margin-top: 4px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  padding: 14px 16px;
  border: 1px dashed var(--border);
  border-radius: 8px;
}
.table-wrap {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow-x: auto;
}
.mini-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.mini-table th {
  text-align: left;
  font-weight: 500;
  font-size: 12px;
  color: var(--text-3);
  background: var(--neutral-soft);
  padding: 8px 12px;
  white-space: nowrap;
}
.mini-table td {
  padding: 9px 12px;
  border-top: 1px solid var(--border);
  color: var(--text);
  vertical-align: top;
}
.mini-table tr:hover td { background: var(--neutral-soft); }
.mini-table .r { text-align: right; white-space: nowrap; }
.mini-table .strong { font-weight: 500; white-space: nowrap; }
.mini-table .note { color: var(--text-2); font-size: 12px; min-width: 160px; }
.type-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 99px;
  background: var(--brand-soft);
  color: var(--brand);
  white-space: nowrap;
}
.rate { color: var(--brand); font-weight: 600; }
.small { font-size: 11px; }
.att-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.att-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: border-color 0.15s, background 0.15s;
}
.att-item:hover { border-color: var(--brand); background: var(--brand-soft); }
.att-icon { color: var(--brand); flex-shrink: 0; }
.att-body { flex: 1; min-width: 0; }
.att-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.att-meta { font-size: 11px; margin-top: 2px; }
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--text-2);
  flex-shrink: 0;
}
.icon-btn:hover { background: var(--surface); color: var(--brand); }
</style>
