/**
 * 业务枚举。取值与 Prisma schema 中的 enum 保持一致（字符串相同），
 * 前端不依赖 @prisma/client，因此在这里单独维护一份。
 */

export const Role = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF',
  ORG: 'ORG',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

/** 同一账号只允许一处登录的角色（后登录的会挤掉先登录的）；机构账号可能多人共用，不限制 */
export const SINGLE_SESSION_ROLES: readonly Role[] = ['ADMIN', 'STAFF'];

/** 业务错误码：账号已在其他设备登录，当前登录被挤下线 */
export const KICKED_OUT_CODE = 40101;

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: '管理员',
  STAFF: '员工',
  ORG: '机构',
};

export const OrgStatus = {
  NEGOTIATING: 'NEGOTIATING',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  TERMINATED: 'TERMINATED',
} as const;
export type OrgStatus = (typeof OrgStatus)[keyof typeof OrgStatus];

export const ORG_STATUS_LABEL: Record<OrgStatus, string> = {
  NEGOTIATING: '洽谈中',
  ACTIVE: '合作中',
  PAUSED: '暂停',
  TERMINATED: '终止',
};

/** 待到账 / 已结算（待审核、已驳回是以前的审核流程留下的，已不再使用） */
export const DealStatus = {
  PENDING_AUDIT: 'PENDING_AUDIT',
  REJECTED: 'REJECTED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  SETTLED: 'SETTLED',
} as const;
export type DealStatus = (typeof DealStatus)[keyof typeof DealStatus];

export const DEAL_STATUS_LABEL: Record<DealStatus, string> = {
  PENDING_AUDIT: '待审核',
  REJECTED: '已驳回',
  PENDING_PAYMENT: '待到账',
  SETTLED: '已结算',
};

/** 现在用到的成交状态（筛选、下拉用） */
export const ACTIVE_DEAL_STATUSES = [DealStatus.PENDING_PAYMENT, DealStatus.SETTLED] as const;

/** 已核实的成交（计入成交额统计） */
export const APPROVED_DEAL_STATUSES: readonly DealStatus[] = [
  DealStatus.PENDING_PAYMENT,
  DealStatus.SETTLED,
];

export const SettleCycle = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
} as const;
export type SettleCycle = (typeof SettleCycle)[keyof typeof SettleCycle];

export const SETTLE_CYCLE_LABEL: Record<SettleCycle, string> = {
  MONTHLY: '月结',
  QUARTERLY: '季结',
};

export const ORG_LEVELS = ['A', 'B', 'C'] as const;
export type OrgLevel = (typeof ORG_LEVELS)[number];

/** 机构附件分类（按这个顺序显示） */
export const AttachmentCategory = {
  INTRO: 'INTRO',
  MANUAL: 'MANUAL',
  SERVICE: 'SERVICE',
  CASE: 'CASE',
  REVIEW: 'REVIEW',
  LICENSE: 'LICENSE',
  OTHER: 'OTHER',
  /** 以下两类已不再提供上传，只用来显示以前上传的文件 */
  QUALIFICATION: 'QUALIFICATION',
  CONTRACT: 'CONTRACT',
} as const;
export type AttachmentCategory = (typeof AttachmentCategory)[keyof typeof AttachmentCategory];

export const ATTACHMENT_CATEGORY_LABEL: Record<AttachmentCategory, string> = {
  INTRO: '机构介绍',
  MANUAL: '产品手册',
  SERVICE: '服务细则',
  CASE: '成功案例',
  REVIEW: '好评截图',
  LICENSE: '营业执照',
  OTHER: '其他',
  QUALIFICATION: '资质证书',
  CONTRACT: '合同协议',
};
/** 上传时可选的分类 */
export const ATTACHMENT_UPLOAD_CATEGORIES: AttachmentCategory[] = ['INTRO', 'MANUAL', 'SERVICE', 'CASE', 'REVIEW', 'LICENSE', 'OTHER'];

/** 单个附件大小上限（MB） */
export const ATTACHMENT_MAX_MB = 20;

/**
 * 常用业务类型（下拉里的快捷选项）。机构 / 产品还可以自定义输入其他类型，
 * 所以库里存的是任意字符串，这里只是推荐项。
 */
export const BUSINESS_TYPES = ['留学', '语培', '竞赛', '科研', '求职', '公益', '作品集'] as const;
/** 自定义业务类型的长度上限 */
export const BUSINESS_TYPE_MAX_LEN = 20;

/** 产品推荐级别：1 级为主推，数字越小越靠前 */
export const PRODUCT_LEVELS = [1, 2, 3, 4] as const;
/** 每家机构最多几个主推（1 级）产品 */
export const MAX_MAIN_PRODUCTS = 2;
export const PRODUCT_LEVEL_LABEL: Record<number, string> = { 1: '1 级 · 主推', 2: '2 级', 3: '3 级', 4: '4 级' };

/**
 * 覆盖国家和地区，按大洲分组；"热门留学目的地"排在最前。
 * 港澳台统一使用"中国香港 / 中国澳门 / 中国台湾"的写法。
 */
export const COUNTRY_GROUPS = [
  {
    label: '热门留学目的地',
    items: ['美国', '英国', '加拿大', '澳大利亚', '新西兰', '新加坡', '中国香港', '中国澳门', '日本', '韩国', '德国', '法国', '荷兰', '爱尔兰', '马来西亚'],
  },
  {
    label: '亚洲',
    items: [
      '中国台湾', '泰国', '菲律宾', '印度尼西亚', '越南', '柬埔寨', '老挝', '缅甸', '文莱', '东帝汶',
      '蒙古', '朝鲜', '印度', '巴基斯坦', '孟加拉国', '斯里兰卡', '尼泊尔', '不丹', '马尔代夫', '阿富汗',
      '哈萨克斯坦', '乌兹别克斯坦', '吉尔吉斯斯坦', '塔吉克斯坦', '土库曼斯坦',
      '阿联酋', '沙特阿拉伯', '卡塔尔', '科威特', '巴林', '阿曼', '也门', '伊朗', '伊拉克', '约旦',
      '黎巴嫩', '叙利亚', '以色列', '巴勒斯坦', '土耳其', '塞浦路斯', '格鲁吉亚', '亚美尼亚', '阿塞拜疆',
    ],
  },
  {
    label: '欧洲',
    items: [
      '瑞士', '瑞典', '挪威', '丹麦', '芬兰', '冰岛', '比利时', '卢森堡', '奥地利', '意大利',
      '西班牙', '葡萄牙', '希腊', '马耳他', '摩纳哥', '列支敦士登', '安道尔', '圣马力诺', '梵蒂冈',
      '俄罗斯', '乌克兰', '白俄罗斯', '摩尔多瓦', '波兰', '捷克', '斯洛伐克', '匈牙利', '罗马尼亚', '保加利亚',
      '塞尔维亚', '克罗地亚', '斯洛文尼亚', '波黑', '黑山', '北马其顿', '阿尔巴尼亚', '科索沃',
      '爱沙尼亚', '拉脱维亚', '立陶宛',
    ],
  },
  {
    label: '北美洲',
    items: [
      '墨西哥', '古巴', '牙买加', '海地', '多米尼加', '巴哈马', '巴巴多斯', '特立尼达和多巴哥',
      '格林纳达', '圣卢西亚', '圣文森特和格林纳丁斯', '安提瓜和巴布达', '圣基茨和尼维斯', '多米尼克',
      '危地马拉', '伯利兹', '洪都拉斯', '萨尔瓦多', '尼加拉瓜', '哥斯达黎加', '巴拿马', '波多黎各',
    ],
  },
  {
    label: '南美洲',
    items: ['巴西', '阿根廷', '智利', '秘鲁', '哥伦比亚', '委内瑞拉', '厄瓜多尔', '玻利维亚', '巴拉圭', '乌拉圭', '圭亚那', '苏里南'],
  },
  {
    label: '大洋洲',
    items: [
      '斐济', '巴布亚新几内亚', '萨摩亚', '汤加', '瓦努阿图', '所罗门群岛', '基里巴斯', '密克罗尼西亚',
      '马绍尔群岛', '帕劳', '瑙鲁', '图瓦卢', '库克群岛', '纽埃',
    ],
  },
  {
    label: '非洲',
    items: [
      '埃及', '南非', '摩洛哥', '阿尔及利亚', '突尼斯', '利比亚', '苏丹', '南苏丹', '埃塞俄比亚', '肯尼亚',
      '坦桑尼亚', '乌干达', '卢旺达', '布隆迪', '尼日利亚', '加纳', '科特迪瓦', '塞内加尔', '马里', '尼日尔',
      '布基纳法索', '几内亚', '几内亚比绍', '塞拉利昂', '利比里亚', '多哥', '贝宁', '冈比亚', '佛得角', '毛里塔尼亚',
      '喀麦隆', '乍得', '中非', '加蓬', '刚果（布）', '刚果（金）', '赤道几内亚', '圣多美和普林西比',
      '安哥拉', '赞比亚', '津巴布韦', '马拉维', '莫桑比克', '纳米比亚', '博茨瓦纳', '莱索托', '斯威士兰',
      '马达加斯加', '毛里求斯', '塞舌尔', '科摩罗', '索马里', '吉布提', '厄立特里亚',
    ],
  },
] as const;

/** 全部覆盖国家和地区（扁平列表，供校验使用） */
export const COUNTRIES = COUNTRY_GROUPS.flatMap((g) => g.items) as unknown as readonly [
  (typeof COUNTRY_GROUPS)[number]['items'][number],
  ...(typeof COUNTRY_GROUPS)[number]['items'][number][],
];
