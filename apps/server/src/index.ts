import { config } from './config';
import { createApp } from './app';
import { prisma } from './lib/prisma';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[bd-crm] API 已启动 http://localhost:${config.port}/api`);
});

async function shutdown(signal: string) {
  console.log(`[bd-crm] 收到 ${signal}，正在关闭...`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
