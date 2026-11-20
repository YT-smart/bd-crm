import { config } from './config';
import { createApp } from './app';
import { prisma } from './lib/prisma';
import { pruneOldNotifications } from './services/notification.service';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[bd-crm] API 已启动 http://localhost:${config.port}/api`);
});

// 每天清理一次 90 天前已读的消息提醒
const prune = () => pruneOldNotifications().catch((e) => console.error('[notify] 清理失败', e));
setTimeout(prune, 60_000);
setInterval(prune, 24 * 3600 * 1000).unref();

async function shutdown(signal: string) {
  console.log(`[bd-crm] 收到 ${signal}，正在关闭...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
