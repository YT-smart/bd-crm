import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { ATTACHMENT_MAX_MB } from '@bdcrm/shared';
import { AppError } from '../lib/http';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ code: 404, data: null, message: `接口不存在：${req.method} ${req.path}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ code: err.code, data: null, message: err.message });
    return;
  }
  if (err instanceof MulterError) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? `单个文件不能超过 ${ATTACHMENT_MAX_MB}MB`
        : err.code === 'LIMIT_FILE_COUNT'
          ? '一次最多上传 10 个文件'
          : `上传失败：${err.message}`;
    res.status(400).json({ code: 400, data: null, message: msg });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path.join('.');
    res.status(400).json({
      code: 400,
      data: err.issues,
      message: first ? `${field ? field + '：' : ''}${first.message}` : '请求参数有误',
    });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      res.status(404).json({ code: 404, data: null, message: '数据不存在' });
      return;
    }
    if (err.code === 'P2002') {
      res.status(409).json({ code: 409, data: null, message: '数据重复，请检查名称或账号是否已存在' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ code: 409, data: null, message: '存在关联数据，无法完成该操作' });
      return;
    }
  }
  console.error('[unhandled]', err);
  res.status(500).json({ code: 500, data: null, message: '服务器内部错误' });
}
