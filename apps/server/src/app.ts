import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error';

export function createApp() {
  const app = express();

  // 只信任本机 / 内网的反向代理（Nginx）转发的 IP；设为 true 会让任何人通过 X-Forwarded-For 伪造 IP
  app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal');
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.use('/api', routes);
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
