# BD-CRM 留学合作机构管理系统

npm workspaces 单仓（monorepo）：

```
apps/server      Express 5 + TypeScript + Prisma 6 + Zod + JWT（httpOnly Cookie）
apps/web         Vue 3 + Vite + TypeScript + Naive UI + Pinia + ECharts
packages/shared  前后端共享：枚举、权限点、省份、资料完整度规则、接口类型
bd-crm/          旧 demo，仅作参考，不参与构建
```

## 本地开发

环境要求：Node.js 20 及以上、Docker。

```bash
npm install
npm run db:up                         # 启动 PostgreSQL 16（宿主端口 5433）
cp apps/server/.env.example apps/server/.env   # 首次使用时执行（已有 .env 可跳过）
npm run db:migrate                    # 执行数据库迁移
npm run db:seed                       # 写入演示数据（会清空业务表）
npm run dev                           # 同时启动 API(3100) 和前端(5180)
```

浏览器打开 http://localhost:5180

| 账号 | 密码 | 角色 |
|---|---|---|
| admin | Admin@123 | 管理员 |
| staff01 / staff02 | Staff@123 | 员工 |
| staff03 | Staff@123 | 员工（首次登录需强制改密） |
| org01 ~ org03 | Org@12345 | 机构 |

## 常用脚本

| 命令 | 说明 |
|---|---|
| `npm run typecheck` | 前后端类型检查 |
| `npm run build` | 构建：后端产物在 `apps/server/dist`，前端在 `apps/web/dist` |
| `npm run db:studio` | 打开 Prisma Studio |
| `npm run db:reset` | 重建数据库并重新写入演示数据 |

## 端口

| 服务 | 端口 |
|---|---|
| PostgreSQL（Docker） | 5433（本机 5432 已被占用） |
| API | 3100 |
| Web（Vite） | 5180，`/api` 代理到 3100 |

## 中国地图

省级 GeoJSON 来自阿里云 DataV，存放在 `apps/web/public/geo/china.json`。
`Org.province` 存的是省份全称（如“广东省”），与 GeoJSON 中的 `name` 完全一致，
完整列表见 `packages/shared/src/regions.ts`。

## 开发进度

- [x] 阶段 1：单仓工程、数据建模、登录与权限、布局与主题、仪表盘（含中国地图）、机构列表（基础版）、个人设置
- [ ] 阶段 2：合作机构（详情、编辑、联系人与产品、导入导出、附件）
- [ ] 阶段 3：成交与结算
- [ ] 阶段 4：账号管理 / 操作日志
- [ ] 阶段 6-7：联调、部署
