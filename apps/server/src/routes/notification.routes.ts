import { Router } from 'express';
import { z } from 'zod';
import { ok } from '../lib/http';
import { listNotifications, markAllRead, markRead, unreadCount } from '../services/notification.service';

/** 消息提醒：每个账号只能看、只能标记自己的 */
const router = Router();

const category = z.enum(['ORG', 'LEAD', 'DEAL']);

router.get('/unread-count', async (req, res) => {
  ok(res, await unreadCount(req.user!.id));
});

const listSchema = z.object({
  category: category.optional(),
  unreadOnly: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

router.get('/', async (req, res) => {
  ok(res, await listNotifications(req.user!.id, listSchema.parse(req.query)));
});

router.post('/read-all', async (req, res) => {
  const { category: c } = z.object({ category: category.optional() }).parse(req.body ?? {});
  ok(res, { updated: await markAllRead(req.user!.id, c) });
});

router.post('/:id/read', async (req, res) => {
  await markRead(req.user!.id, req.params.id);
  ok(res, null);
});

export default router;
