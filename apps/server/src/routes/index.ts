import { Router } from 'express';
import { requireAuth, requirePasswordReady } from '../middlewares/auth';
import authRoutes from './auth.routes';
import dashboardRoutes from './dashboard.routes';
import orgRoutes from './org.routes';
import dealRoutes from './deal.routes';
import logRoutes from './log.routes';
import userRoutes from './user.routes';
import shareRoutes from './share.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ code: 0, data: { status: 'ok', time: new Date().toISOString() }, message: 'ok' });
});

router.use('/auth', authRoutes);
// 附件分享链接：免登录，凭签名令牌访问
router.use('/share', shareRoutes);

// 以下业务接口：需登录，且已完成首次改密
router.use(requireAuth, requirePasswordReady);
router.use('/dashboard', dashboardRoutes);
router.use('/orgs', orgRoutes);
router.use('/deals', dealRoutes);
router.use('/logs', logRoutes);
router.use('/users', userRoutes);

export default router;
