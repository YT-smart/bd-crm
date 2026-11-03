/**
 * 省级行政区名称，与 DataV GeoJSON（apps/web/public/geo/china.json）中的 name 完全一致，
 * 数据库 Org.province 存的也是这些全称，地图可直接按名称匹配。
 */
export const PROVINCES = [
  '北京市',
  '天津市',
  '河北省',
  '山西省',
  '内蒙古自治区',
  '辽宁省',
  '吉林省',
  '黑龙江省',
  '上海市',
  '江苏省',
  '浙江省',
  '安徽省',
  '福建省',
  '江西省',
  '山东省',
  '河南省',
  '湖北省',
  '湖南省',
  '广东省',
  '广西壮族自治区',
  '海南省',
  '重庆市',
  '四川省',
  '贵州省',
  '云南省',
  '西藏自治区',
  '陕西省',
  '甘肃省',
  '青海省',
  '宁夏回族自治区',
  '新疆维吾尔自治区',
  '台湾省',
  '香港特别行政区',
  '澳门特别行政区',
] as const;
export type Province = (typeof PROVINCES)[number];

const SUFFIX_RE = /(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/;

/** 广东省 -> 广东，内蒙古自治区 -> 内蒙古 */
export function shortProvinceName(name: string): string {
  return name.replace(SUFFIX_RE, '');
}

export function isProvince(name: string): name is Province {
  return (PROVINCES as readonly string[]).includes(name);
}
