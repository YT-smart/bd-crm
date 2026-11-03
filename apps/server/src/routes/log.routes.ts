import { Router } from 'express';
import { z } from 'zod';
import { PERM } from '@bdcrm/shared';
import { ok } from '../lib/http';
import { requirePerm } from '../middlewares/auth';
import { DAY_RE } from '../lib/date';
import { listAuditLogs, listAuditModules } from '../services/log.service';

const router = Router();

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  module: z.string().max(30).optional(),
  action: z.string().max(50).optional(),
  userId: z.string().cuid().optional(),
  keyword: z.string().trim().max(50).optional(),
  startDate: z.string().regex(DAY_RE).optional(),
  endDate: z.string().regex(DAY_RE).optional(),
});

router.get('/', requirePerm(PERM.LOG_VIEW), async (req, res) => {
  ok(res, await listAuditLogs(querySchema.parse(req.query)));
});

router.get('/modules', requirePerm(PERM.LOG_VIEW), async (_req, res) => {
  ok(res, await listAuditModules());
});

export default router;
