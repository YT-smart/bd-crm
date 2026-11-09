/**
 * 客户线索：学生从抖音、小红书等渠道进来，员工跟进后推送给合作机构，签约后转成交。
 * 选项都存中文字符串，方便以后在这里增删，不需要改数据库。
 */

/** 推出状态（推送给机构的进度） */
export const LEAD_PUSH_STATUS = ['未推出', '已推出', '重点跟进', '已签约'] as const;
export type LeadPushStatus = (typeof LEAD_PUSH_STATUS)[number];

/** 来源渠道 */
export const LEAD_SOURCES = [
  '抖音', '小红书', '视频号', '公众号', 'B站', '知乎', '官网', '朋友转介绍', '老学员转介绍', '地推活动', '其他',
] as const;

/** 产品标签（意向产品，可多选） */
export const LEAD_PRODUCT_TAGS = [
  '留学', '留学辅导', '语培', '竞赛', '科研', '背提', '实习求职', '合作办学', '国际学校', '艺术项目', '公益', '未明确',
] as const;

/** 就读年级 */
export const LEAD_GRADES = [
  '7年级以下', '7年级', '8年级', '9年级', '10年级', '11年级', '12年级', '高中毕业',
  '大一', '大二', '大三', '大四', '本科已毕业', '研究生', '博士', '未明确',
] as const;

/** 申请学历 */
export const LEAD_DEGREES = ['中学', '国际高中', '本科', '硕士', '博士', '未明确'] as const;

/** 添加微信 */
export const LEAD_WECHAT_STATUS = ['未添加', '已添加', '已通过', '等通过'] as const;

/** 留学地区（可多选） */
export const LEAD_REGIONS = [
  '美国', '加拿大', '英爱', '澳新', '中国港澳', '新加坡', '马来', '日韩', '欧洲', '内地合办', '其他', '未明确',
] as const;

/** 意向度 */
export const LEAD_INTENTIONS = [
  '重点跟进', '已面谈', '考虑中', '已签约', '待跟进', '未回复', '长线客户', '联系不上', '放弃',
] as const;

/** 跟进方式 */
export const LEAD_FOLLOW_METHODS = ['电话', '微信', '面谈', '其他'] as const;
