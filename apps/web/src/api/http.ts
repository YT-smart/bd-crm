import type { ApiResponse } from '@bdcrm/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: number,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** 401 时不触发全局跳转（用于启动时探测登录态） */
  silent?: boolean;
}

let unauthorizedHandler: ((err: ApiError) => void) | null = null;
export function onUnauthorized(fn: (err: ApiError) => void) {
  unauthorizedHandler = fn;
}

function buildQuery(query?: Query) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.append(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function request<T>(method: string, url: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${url}${buildQuery(opts.query)}`, {
      method,
      credentials: 'include',
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, '网络异常，请检查网络或稍后重试');
  }

  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    /* 非 JSON 响应 */
  }

  if (!res.ok || !payload || payload.code !== 0) {
    const err = new ApiError(res.status, payload?.message ?? `请求失败（${res.status}）`, payload?.code);
    if (res.status === 401 && !opts.silent) unauthorizedHandler?.(err);
    throw err;
  }
  return payload.data;
}

export const http = {
  get: <T>(url: string, query?: Query, opts?: Omit<RequestOptions, 'query'>) => request<T>('GET', url, { ...opts, query }),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, { body }),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, { body }),
  del: <T>(url: string) => request<T>('DELETE', url),
  /** multipart 上传，onProgress 回调 0-100 */
  upload: <T>(url: string, form: FormData, onProgress?: (pct: number) => void) =>
    new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api${url}`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onerror = () => reject(new ApiError(0, '网络异常，请检查网络或稍后重试'));
      xhr.onload = () => {
        let payload: ApiResponse<T> | null = null;
        try {
          payload = JSON.parse(xhr.responseText) as ApiResponse<T>;
        } catch {
          /* ignore */
        }
        if (xhr.status >= 200 && xhr.status < 300 && payload && payload.code === 0) {
          resolve(payload.data);
          return;
        }
        const err = new ApiError(xhr.status, payload?.message ?? `上传失败（${xhr.status}）`, payload?.code);
        if (xhr.status === 401) unauthorizedHandler?.(err);
        reject(err);
      };
      xhr.send(form);
    }),
};
