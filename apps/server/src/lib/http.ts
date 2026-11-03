import type { Response } from 'express';
import type { ApiResponse } from '@bdcrm/shared';

/** 业务异常：status 为 HTTP 状态码，message 直接展示给用户 */
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: number = status,
  ) {
    super(message);
  }
}

export const Errors = {
  badRequest: (msg = '请求参数有误') => new AppError(400, msg),
  unauthorized: (msg = '登录已失效，请重新登录') => new AppError(401, msg),
  forbidden: (msg = '没有权限执行该操作') => new AppError(403, msg),
  notFound: (msg = '数据不存在') => new AppError(404, msg),
  locked: (msg: string) => new AppError(423, msg),
  tooMany: (msg: string) => new AppError(429, msg),
};

export function ok<T>(res: Response, data: T, statusOrMessage?: number | string, message = 'ok') {
  let status = 200;
  if (typeof statusOrMessage === 'number') {
    status = statusOrMessage;
  } else if (typeof statusOrMessage === 'string') {
    message = statusOrMessage;
  }
  const body: ApiResponse<T> = { code: 0, data, message };
  res.status(status).json(body);
}
