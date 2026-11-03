import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { ATTACHMENT_MAX_MB } from '@bdcrm/shared';
import { AppError } from './http';

/**
 * 本地磁盘附件存储。数据库 Attachment.url 只保存相对 key（如 orgs/<orgId>/<uuid>.pdf），
 * 下载必须经过鉴权接口，不对外暴露静态目录。后续换 OSS 只需替换本文件。
 */
export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');

/** 允许的扩展名 -> 服务端认定的 MIME。绝不使用客户端上传时声明的类型。 */
const MIME_BY_EXT: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
};
const ALLOWED_EXT = new Set(Object.keys(MIME_BY_EXT));

/** 允许在浏览器内联预览的类型（不含任何可执行脚本的格式） */
const INLINE_EXT = new Set(['.pdf', '.txt', '.jpg', '.jpeg', '.png', '.webp', '.gif']);

const extOf = (name: string) => path.extname(name).toLowerCase();

export function mimeOf(name: string) {
  return MIME_BY_EXT[extOf(name)] ?? 'application/octet-stream';
}

export function canInline(name: string) {
  return INLINE_EXT.has(extOf(name));
}

export function isPdf(name: string) {
  return extOf(name) === '.pdf';
}

/** multer 会把中文文件名按 latin1 解析，这里转回 utf8 */
export function decodeOriginalName(name: string) {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

export function orgUploader() {
  return multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        const dir = path.join(UPLOAD_ROOT, 'orgs', String(req.params.id));
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(decodeOriginalName(file.originalname)).toLowerCase();
        cb(null, `${randomUUID()}${ext}`);
      },
    }),
    limits: { fileSize: ATTACHMENT_MAX_MB * 1024 * 1024, files: 10 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(decodeOriginalName(file.originalname)).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        cb(new AppError(400, `不支持的文件类型：${ext || '未知'}`));
        return;
      }
      cb(null, true);
    },
  });
}

/** 磁盘绝对路径 -> 存库用的相对 key */
export function toStorageKey(absPath: string) {
  return path.relative(UPLOAD_ROOT, absPath).split(path.sep).join('/');
}

/** 相对 key -> 磁盘绝对路径（防目录穿越） */
export function resolveStorageKey(key: string) {
  const abs = path.resolve(UPLOAD_ROOT, key);
  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) throw new AppError(400, '非法文件路径');
  return abs;
}

export async function removeStoredFile(key: string) {
  try {
    await fs.promises.unlink(resolveStorageKey(key));
  } catch {
    /* 文件已不存在时忽略 */
  }
}
