import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { Errors } from '../lib/http';
import { verifyShareToken } from '../lib/share';
import { canInline, isPdf, mimeOf, resolveStorageKey } from '../lib/storage';

/** 附件分享（免登录）：凭签名令牌访问单个附件 */
const router = Router();

async function findShared(token: string) {
  const t = verifyShareToken(token);
  if (!t) throw Errors.notFound('分享链接无效或已过期');
  const a = await prisma.attachment.findUnique({
    where: { id: t.attachmentId },
    include: { org: { select: { name: true, deletedAt: true } } },
  });
  if (!a || !a.org || a.org.deletedAt) throw Errors.notFound('文件已被删除');
  return { a, expiresAt: t.expiresAt };
}

router.get('/:token', async (req, res) => {
  const { a, expiresAt } = await findShared(req.params.token);
  res.json({
    code: 0,
    message: 'ok',
    data: {
      name: a.name,
      size: a.size,
      orgName: a.org!.name,
      createdAt: a.createdAt.toISOString(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    },
  });
});

router.get('/:token/file', async (req, res) => {
  const { a } = await findShared(req.params.token);
  const inline = req.query.inline === '1' && canInline(a.name);
  if (inline && isPdf(a.name)) res.removeHeader('Content-Security-Policy');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(a.name)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(resolveStorageKey(a.url), { headers: { 'Content-Type': mimeOf(a.name) } }, (err) => {
    if (err && !res.headersSent) res.status(404).json({ code: 404, data: null, message: '文件已丢失' });
  });
});

export default router;
