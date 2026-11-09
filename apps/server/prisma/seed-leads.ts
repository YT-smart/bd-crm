/**
 * 客户线索演示数据。seed.ts 会调用；也可以单独执行，只重建线索，不动其他数据：
 *   npx tsx prisma/seed-leads.ts
 */
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  LEAD_DEGREES,
  LEAD_FOLLOW_METHODS,
  LEAD_GRADES,
  LEAD_INTENTIONS,
  LEAD_PRODUCT_TAGS,
  LEAD_REGIONS,
  LEAD_SOURCES,
  LEAD_WECHAT_STATUS,
} from '@bdcrm/shared';

let s = 20261108;
function rand() {
  s = (s * 1103515245 + 12345) & 0x7fffffff;
  return s / 0x7fffffff;
}
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;
const DAY = 24 * 3600 * 1000;

const SURNAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾萧田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤';
const GIVEN = ['子涵', '欣怡', '浩然', '梓萱', '宇轩', '诗涵', '一诺', '雨桐', '俊熙', '思彤', '睿', '可馨', '博文', '佳怡', '子墨', '若曦', '天佑', '晨曦', '嘉懿', '明哲'];
const FOLLOW_TEXT = [
  '电话沟通了申请时间线，家长比较关心排名和费用',
  '已加微信，发了机构介绍和往年案例',
  '学生在准备雅思，目标 7 分，下周再约面谈',
  '家长在对比两家机构，倾向于有保录承诺的',
  '约了周六到校区面谈',
  '暂时没回复，过几天再跟',
  '对科研项目感兴趣，想了解导师背景',
  '预算 30 万左右，想走英国 + 香港双申',
];

export async function seedLeads(prisma: PrismaClient, count = 180) {
  await prisma.leadFollow.deleteMany();
  await prisma.lead.deleteMany();

  const users = await prisma.user.findMany({ where: { role: { in: ['ADMIN', 'STAFF'] } }, select: { id: true, role: true } });
  const staffs = users.filter((u) => u.role === 'STAFF');
  const admin = users.find((u) => u.role === 'ADMIN')!;
  const orgs = await prisma.org.findMany({ where: { deletedAt: null }, select: { id: true }, take: 40 });
  const now = Date.now();

  let follows = 0;
  for (let i = 0; i < count; i++) {
    const createdAt = new Date(now - Math.floor(rand() * 120) * DAY - Math.floor(rand() * DAY));
    const creator = chance(0.25) ? admin : pick(staffs);
    const assignee = creator.role === 'STAFF' ? creator : chance(0.85) ? pick(staffs) : null;
    const pushStatus = pick(['未推出', '未推出', '已推出', '已推出', '重点跟进', '已签约'] as const);
    const org = pushStatus === '未推出' ? null : pick(orgs);
    const tags = [...new Set([pick(LEAD_PRODUCT_TAGS), ...(chance(0.4) ? [pick(LEAD_PRODUCT_TAGS)] : [])])];
    const regions = [...new Set([pick(LEAD_REGIONS), ...(chance(0.3) ? [pick(LEAD_REGIONS)] : [])])];
    const assignedAt = assignee ? new Date(createdAt.getTime() + Math.floor(rand() * 2 * DAY)) : null;

    const lead = await prisma.lead.create({
      data: {
        studentName: pick([...SURNAMES]) + pick(GIVEN),
        phone: chance(0.85) ? `1${pick(['3', '5', '7', '8', '9'])}${String(Math.floor(rand() * 1e9)).padStart(9, '0')}` : null,
        wechat: chance(0.5) ? `wx_${Math.floor(rand() * 1e6)}` : null,
        source: pick(LEAD_SOURCES),
        productTags: tags,
        grade: chance(0.9) ? pick(LEAD_GRADES) : null,
        degree: chance(0.9) ? pick(LEAD_DEGREES) : null,
        regions,
        wechatStatus: pick(LEAD_WECHAT_STATUS),
        intention: pushStatus === '已签约' ? '已签约' : pick(LEAD_INTENTIONS.filter((x) => x !== '已签约')),
        pushStatus,
        orgId: org?.id ?? null,
        pushedAt: org ? new Date(createdAt.getTime() + 3 * DAY) : null,
        assigneeId: assignee?.id ?? null,
        assignedAt,
        createdById: creator.id,
        note: chance(0.4) ? pick(FOLLOW_TEXT) : null,
        createdAt,
      },
    });

    const n = Math.floor(rand() * 4);
    let last: Date | null = null;
    for (let k = 0; k < n; k++) {
      const at = new Date(Math.min(now, createdAt.getTime() + (k + 1) * Math.floor(rand() * 6 + 1) * DAY));
      await prisma.leadFollow.create({
        data: { leadId: lead.id, userId: (assignee ?? creator).id, method: pick(LEAD_FOLLOW_METHODS), content: pick(FOLLOW_TEXT), createdAt: at },
      });
      last = at;
      follows++;
    }
    await prisma.lead.update({ where: { id: lead.id }, data: { lastFollowAt: last, updatedAt: last ?? createdAt } });
  }
  return { leads: count, follows };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient();
  seedLeads(prisma)
    .then((r) => console.log(`线索 ${r.leads} 条，跟进记录 ${r.follows} 条`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
