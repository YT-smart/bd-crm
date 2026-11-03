import { Router } from 'express';
import { z } from 'zod';
import { Role, PERM } from '@bdcrm/shared';
import { ok, Errors } from '../lib/http';
import { requirePerm } from '../middlewares/auth';
import { PASSWORD_RULE } from '../lib/security';
import { writeAudit } from '../services/audit.service';
import {
  listUsers,
  createUser,
  updateUser,
  toggleUserActive,
  resetUserPassword,
  deleteUser,
} from '../services/user.service';

const router = Router();

/* ============ 列表 ============ */

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().trim().max(50).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

router.get('/', requirePerm(PERM.USER_MANAGE), async (req, res) => {
  ok(res, await listUsers(querySchema.parse(req.query)));
});

/* ============ 新增 ============ */

const createSchema = z.object({
  username: z.string().trim().min(3, '用户名至少3个字符').max(30).regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字和下划线'),
  name: z.string().trim().min(1).max(20),
  role: z.nativeEnum(Role),
  orgId: z.string().cuid().nullish(),
  phone: z.string().max(20).nullish(),
  email: z.string().email().max(100).nullish().or(z.literal('')),
  password: z.string().max(64).regex(PASSWORD_RULE, '密码至少 8 位，且同时包含字母和数字'),
}).refine((v) => v.role !== 'ORG' || !!v.orgId, { message: '机构账号必须绑定机构', path: ['orgId'] });

router.post('/', requirePerm(PERM.USER_MANAGE), async (req, res) => {
  const input = createSchema.parse(req.body);
  const result = await createUser(input);
  writeAudit(req, { module: 'user', action: 'create', targetId: result.id, targetName: result.name });
  ok(res, result, 201);
});

/* ============ 编辑 ============ */

const updateSchema = z.object({
  name: z.string().trim().min(1).max(20).optional(),
  role: z.nativeEnum(Role).optional(),
  orgId: z.string().cuid().nullish(),
  phone: z.string().max(20).nullish(),
  email: z.string().email().max(100).nullish().or(z.literal('')),
});

router.put('/:id', requirePerm(PERM.USER_MANAGE), async (req, res) => {
  if (req.params.id === req.user!.id) throw Errors.badRequest('不能修改自己的角色');
  const input = updateSchema.parse(req.body);
  const user = await updateUser(req.params.id, input);
  writeAudit(req, { module: 'user', action: 'update', targetId: user.id, targetName: user.name, after: input });
  ok(res, { id: user.id });
});

/* ============ 启用 / 停用 ============ */

router.post('/:id/toggle-active', requirePerm(PERM.USER_MANAGE), async (req, res) => {
  if (req.params.id === req.user!.id) throw Errors.badRequest('不能停用自己');
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
  const user = await toggleUserActive(req.params.id, isActive);
  writeAudit(req, { module: 'user', action: isActive ? 'enable' : 'disable', targetId: user.id, targetName: user.name });
  ok(res, { isActive: user.isActive });
});

/* ============ 重置密码 ============ */

router.post('/:id/reset-password', requirePerm(PERM.USER_MANAGE), async (req, res) => {
  const { password } = z
    .object({ password: z.string().max(64).regex(PASSWORD_RULE, '密码至少 8 位，且同时包含字母和数字') })
    .parse(req.body);
  const user = await resetUserPassword(req.params.id, password);
  writeAudit(req, { module: 'user', action: 'resetPassword', targetId: user.id, targetName: user.name });
  ok(res, null);
});

/* ============ 删除 ============ */

router.delete('/:id', requirePerm(PERM.USER_MANAGE), async (req, res) => {
  if (req.params.id === req.user!.id) throw Errors.badRequest('不能删除自己');
  await deleteUser(req.params.id);
  writeAudit(req, { module: 'user', action: 'delete', targetId: req.params.id });
  ok(res, null);
});

export default router;
