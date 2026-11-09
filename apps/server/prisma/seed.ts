/**
 * 开发环境演示数据。可重复执行：会先清空业务表再写入。
 *   npm run db:seed
 *
 * 默认账号（见 README）：
 *   admin   / Admin@123   管理员
 *   staff01 / Staff@123   员工
 *   org01   / Org@12345   机构（绑定第一家机构）
 */
import { PrismaClient, type DealStatus, type OrgStatus, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BUSINESS_TYPES, COUNTRY_GROUPS, computeCompleteness } from '@bdcrm/shared';
import { seedLeads } from './seed-leads';

const prisma = new PrismaClient();

/* ---------- 可复现的伪随机 ---------- */
let seed = 20261030;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;
function pickWeighted<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1]![0];
}
function sample<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]!);
  return out;
}
const DAY = 24 * 3600 * 1000;
/** 演示用的分公司城市 */
const BRANCH_CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '重庆', '苏州', '长沙', '天津', '青岛', '厦门'];

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY);
const round2 = (n: number) => Math.round(n * 100) / 100;

/* ---------- 基础字典 ---------- */
const CITIES: readonly (readonly [[string, string], number])[] = [
  [['北京市', '北京'], 12],
  [['上海市', '上海'], 11],
  [['广东省', '广州'], 7],
  [['广东省', '深圳'], 7],
  [['广东省', '佛山'], 1],
  [['广东省', '东莞'], 1],
  [['浙江省', '杭州'], 5],
  [['浙江省', '宁波'], 2],
  [['江苏省', '南京'], 4],
  [['江苏省', '苏州'], 3],
  [['江苏省', '无锡'], 1],
  [['四川省', '成都'], 5],
  [['湖北省', '武汉'], 4],
  [['陕西省', '西安'], 3],
  [['山东省', '青岛'], 2],
  [['山东省', '济南'], 2],
  [['天津市', '天津'], 3],
  [['重庆市', '重庆'], 3],
  [['福建省', '厦门'], 2],
  [['福建省', '福州'], 1],
  [['湖南省', '长沙'], 3],
  [['河南省', '郑州'], 2],
  [['辽宁省', '大连'], 2],
  [['辽宁省', '沈阳'], 1],
  [['安徽省', '合肥'], 2],
  [['云南省', '昆明'], 1],
  [['黑龙江省', '哈尔滨'], 1],
  [['江西省', '南昌'], 1],
  [['广西壮族自治区', '南宁'], 1],
  [['河北省', '石家庄'], 1],
  [['山西省', '太原'], 1],
  [['吉林省', '长春'], 1],
  [['贵州省', '贵阳'], 1],
  [['海南省', '海口'], 1],
  [['新疆维吾尔自治区', '乌鲁木齐'], 1],
  [['内蒙古自治区', '呼和浩特'], 1],
  [['甘肃省', '兰州'], 1],
  [['香港特别行政区', '香港'], 1],
];

const BRANDS = ['启航', '博睿', '智领', '远帆', '卓越', '环球', '优途', '领航', '睿思', '嘉华', '明德', '致远', '青藤', '常青', '金桥', '星辰', '汇通', '海纳', '知行', '启明', '蓝海', '英华', '新程', '思齐', '德瑞', '澜途', '鸿鹄', '弘毅', '博雅', '泽众'];
const SUFFIXES = ['留学', '国际教育', '留学服务中心', '教育咨询', '出国留学', '升学规划', '语言培训'];
const SURNAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何林罗高郑梁谢宋唐许韩冯邓曹彭曾萧田董潘袁蔡蒋余于杜叶程魏苏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤'.split('');
const GIVEN = ['子涵', '欣怡', '梓萱', '浩然', '宇轩', '一诺', '思远', '雨桐', '佳怡', '俊杰', '梓睿', '若曦', '晨阳', '诗涵', '嘉懿', '明哲', '沐宸', '可馨', '奕辰', '语嫣', '书瑶', '天佑', '芷若', '博文', '安琪', '景行', '静怡', '思源', '泽宇', '心悦'];
const TITLES = ['校长', '总经理', '市场总监', '合作经理', '运营主管', '顾问主管'];
const PRODUCT_TEMPLATES: readonly { name: string; type: string; min: number; max: number }[] = [
  { name: '美国本科申请全程服务', type: '留学', min: 60000, max: 180000 },
  { name: '英国硕士申请', type: '留学', min: 30000, max: 80000 },
  { name: '澳洲本硕连读规划', type: '留学', min: 35000, max: 90000 },
  { name: '加拿大高中直通车', type: '低龄留学', min: 50000, max: 150000 },
  { name: '新加坡公立大学申请', type: '留学', min: 25000, max: 60000 },
  { name: '香港硕士申请', type: '留学', min: 20000, max: 50000 },
  { name: '雅思 7 分保分班', type: '语培', min: 12000, max: 36000 },
  { name: '托福 100+ 冲刺', type: '语培', min: 15000, max: 40000 },
  { name: '科研背景提升项目', type: '科研', min: 20000, max: 68000 },
  { name: '名校夏校游学营', type: '游学营地', min: 30000, max: 80000 },
  { name: 'A-Level 全科课程', type: '低龄留学', min: 80000, max: 260000 },
];

const phone = () => `1${pick(['3', '5', '7', '8', '9'])}${String(int(0, 999999999)).padStart(9, '0')}`;
const personName = () => pick(SURNAMES) + pick(GIVEN);

async function clear() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.leadFollow.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.orgReview.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.followUp.deleteMany(),
    prisma.deal.deleteMany(),
    prisma.settlement.deleteMany(),
    prisma.orgProduct.deleteMany(),
    prisma.orgContact.deleteMany(),
    prisma.loginLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.org.deleteMany(),
  ]);
}

async function main() {
  console.log('清空旧数据...');
  await clear();

  const hash = (p: string) => bcrypt.hash(p, 10);
  const [adminPwd, staffPwd, orgPwd] = await Promise.all([hash('Admin@123'), hash('Staff@123'), hash('Org@12345')]);

  console.log('创建管理员与员工账号...');
  const admin = await prisma.user.create({
    data: { username: 'admin', name: '张楚颖', role: 'ADMIN', passwordHash: adminPwd, mustChangePwd: false, phone: '13800000001', email: 'admin@bdcrm.local' },
  });
  const staffDefs = [
    { username: 'staff01', name: '李明轩', mustChangePwd: false },
    { username: 'staff02', name: '王思远', mustChangePwd: false },
    { username: 'staff03', name: '陈雨桐', mustChangePwd: true }, // 用于演示首次登录强制改密
  ];
  const staffs = [];
  for (const s of staffDefs) {
    staffs.push(await prisma.user.create({ data: { ...s, role: 'STAFF', passwordHash: staffPwd, phone: phone() } }));
  }
  const bds = [admin, ...staffs];

  console.log('创建合作机构...');
  const usedNames = new Set<string>();
  const ORG_COUNT = 96;
  const orgs: { id: string; status: OrgStatus; level: string; rate: number; createdAt: Date; products: { id: string; min: number; max: number; rate: number | null }[] }[] = [];

  for (let i = 0; i < ORG_COUNT; i++) {
    const [province, city] = pickWeighted(CITIES);
    let name = '';
    do {
      name = `${city}${pick(BRANDS)}${pick(SUFFIXES)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const status = pickWeighted<OrgStatus>([
      ['ACTIVE', 66],
      ['NEGOTIATING', 17],
      ['PAUSED', 10],
      ['TERMINATED', 7],
    ]);
    const level = pickWeighted([
      ['A', 20],
      ['B', 45],
      ['C', 35],
    ] as const);
    const rate = int(16, 50) / 2; // 8% ~ 25%
    // 前 5 家放在本月，便于仪表盘展示「本月新增」
    const createdAt = i < 5 ? daysAgo(int(0, Math.max(0, now.getDate() - 1))) : daysAgo(int(35, 900));

    const rich = chance(0.7);
    const businessTypes = sample(BUSINESS_TYPES, int(1, 3));
    const countries = sample(COUNTRY_GROUPS[0].items, int(1, 5));
    const contactCount = rich ? int(1, 3) : chance(0.5) ? 1 : 0;
    const productTpls = rich || status === 'ACTIVE' ? sample(PRODUCT_TEMPLATES, int(1, 4)) : [];

    const data = {
      name,
      province,
      city,
      intro: rich ? `${name}成立于${int(2008, 2021)}年，专注${businessTypes.join('、')}，主要服务${countries.slice(0, 2).join('、')}方向的学生与家庭。` : null,
      address: rich || chance(0.4) ? `${city}市${pick(['朝阳', '海淀', '天河', '南山', '武侯', '西湖', '鼓楼', '高新'])}区${pick(['中心', '国贸', '科技', '金融'])}大厦 ${int(5, 30)} 层` : null,
      website: chance(rich ? 0.8 : 0.2) ? `https://www.${['qihang', 'borui', 'zhiling', 'yuanfan', 'zhuoyue'][i % 5]}${i + 1}.com` : null,
      wechat: chance(rich ? 0.7 : 0.2) ? `${name}服务号` : null,
      logo: null,
      businessTypes,
      countries,
      // 约 40% 的机构有多个校区（总部城市在前）
      officeCities: [city, ...(chance(0.4) ? sample(BRANCH_CITIES.filter((c) => c !== city), int(1, 4)) : [])],
      tags: sample(['高转化', '重点维护', '新签约', '续约中', '高客单', '低龄方向'], int(0, 2)),
      level,
      status,
      defaultRate: rate,
      settleCycle: chance(0.6) ? ('MONTHLY' as const) : ('QUARTERLY' as const),
      bankInfo: rich && chance(0.7) ? { bank: '招商银行', account: `6214 **** **** ${int(1000, 9999)}`, holder: name } : undefined,
      contractStart: status !== 'NEGOTIATING' && chance(0.8) ? createdAt : null,
      contractEnd: status !== 'NEGOTIATING' ? new Date(createdAt.getTime() + 730 * DAY) : null,
      ownerId: pick(bds).id,
      createdAt,
    };

    const { score } = computeCompleteness({ ...data, contactCount, productCount: productTpls.length });

    const org = await prisma.org.create({
      data: {
        ...data,
        completeness: score,
        contacts: {
          create: Array.from({ length: contactCount }, (_, k) => ({
            name: personName(),
            title: pick(TITLES),
            phone: phone(),
            wechat: chance(0.6) ? `wx_${int(10000, 99999)}` : null,
            isPrimary: k === 0,
          })),
        },
        products: {
          create: productTpls.map((t) => ({
            name: t.name,
            type: t.type,
            priceMin: t.min,
            priceMax: t.max,
            rate: chance(0.25) ? Math.min(30, rate + int(1, 6)) : null,
            level: chance(0.6) ? int(1, 4) : null,
          })),
        },
      },
      include: { products: true },
    });

    orgs.push({
      id: org.id,
      status,
      level,
      rate,
      createdAt,
      products: org.products.map((p) => ({ id: p.id, min: Number(p.priceMin), max: Number(p.priceMax), rate: p.rate ? Number(p.rate) : null })),
    });
  }

  console.log('创建机构账号...');
  const activeOrgs = orgs.filter(
    (o) => o.status === 'ACTIVE' && o.products.length > 0 && now.getTime() - o.createdAt.getTime() > 180 * DAY,
  );
  const orgUsers = [];
  for (let k = 0; k < 3; k++) {
    const o = activeOrgs[k]!;
    orgUsers.push(
      await prisma.user.create({
        data: { username: `org0${k + 1}`, name: `${personName()}`, role: 'ORG', orgId: o.id, passwordHash: orgPwd, mustChangePwd: false, phone: phone() },
      }),
    );
  }
  const orgUserByOrg = new Map(orgUsers.map((u) => [u.orgId!, u]));

  console.log('创建成交记录...');
  const deals: Prisma.DealCreateManyInput[] = [];
  const HORIZON_DAYS = 420; // 约 14 个月

  for (const o of orgs) {
    if (o.status === 'NEGOTIATING' || o.products.length === 0) continue;
    const base = o.level === 'A' ? int(14, 30) : o.level === 'B' ? int(5, 14) : int(0, 6);
    const earliest = Math.min(HORIZON_DAYS, Math.floor((now.getTime() - o.createdAt.getTime()) / DAY));
    if (earliest <= 0) continue;
    const count = Math.min(o.status === 'ACTIVE' ? base : Math.floor(base / 2), earliest < 45 ? 2 : Infinity);

    for (let n = 0; n < count; n++) {
      // 偏向近期，形成逐月增长的趋势
      const ago = Math.floor(Math.pow(rand(), 1.12) * earliest);
      const dealAt = daysAgo(ago);
      const p = pick(o.products);
      const amount = Math.round((p.min + rand() * (p.max - p.min)) / 100) * 100;
      const rate = p.rate ?? o.rate;
      const commission = round2((amount * rate) / 100);

      let status: DealStatus;
      if (ago > 60) {
        status = pickWeighted<DealStatus>([
          ['SETTLED', 84],
          ['PENDING_PAYMENT', 11],
          ['REJECTED', 5],
        ]);
      } else {
        status = pickWeighted<DealStatus>([
          ['PENDING_AUDIT', 28],
          ['PENDING_PAYMENT', 42],
          ['SETTLED', 24],
          ['REJECTED', 6],
        ]);
      }

      const creator = orgUserByOrg.get(o.id) && chance(0.7) ? orgUserByOrg.get(o.id)! : pick(staffs);
      const auditor = pick([admin, ...staffs]);
      const audited = status !== 'PENDING_AUDIT';
      const auditedAt = audited ? new Date(Math.min(now.getTime(), dealAt.getTime() + int(1, 5) * DAY)) : null;
      const settledAt = status === 'SETTLED' ? new Date(Math.min(now.getTime(), dealAt.getTime() + int(12, 55) * DAY)) : null;

      deals.push({
        orgId: o.id,
        productId: p.id,
        studentName: personName(),
        studentPhone: phone(),
        dealAt,
        amount,
        rate,
        commission,
        status,
        rejectReason: status === 'REJECTED' ? pick(['学生信息与合同不一致', '缺少缴费凭证', '重复录入']) : null,
        createdById: creator.id,
        auditedById: audited ? auditor.id : null,
        auditedAt,
        settledAt,
        settledById: settledAt ? admin.id : null,
        settleNote: settledAt && chance(0.05) ? '实际到账金额少 200 元，系银行手续费' : null,
        createdAt: dealAt,
      });
    }
  }

  for (let i = 0; i < deals.length; i += 500) {
    await prisma.deal.createMany({ data: deals.slice(i, i + 500) });
  }

  const leadStat = await seedLeads(prisma);
  console.log(`线索 ${leadStat.leads} 条，跟进记录 ${leadStat.follows} 条`);
  console.log(`完成：机构 ${orgs.length} 家，成交 ${deals.length} 笔，账号 ${1 + staffs.length + orgUsers.length} 个`);
  console.log('登录账号：admin / Admin@123，staff01 / Staff@123，org01 / Org@12345');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
