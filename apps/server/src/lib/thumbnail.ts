import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { UPLOAD_ROOT, resolveStorageKey } from './storage';

/**
 * 图片附件缩略图：第一次请求时用原图生成一张小 webp 存到 uploads/_thumbs/，之后直接复用。
 * 列表只加载缩略图（几十 KB），避免在小带宽服务器上一次拉几十 MB 原图。
 */
const THUMB_DIR = path.join(UPLOAD_ROOT, '_thumbs');
const THUMB_WIDTH = 480;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export const canThumb = (name: string) => IMAGE_EXT.test(name);

const thumbPath = (attachmentId: string) => path.join(THUMB_DIR, `${attachmentId.replace(/[^\w-]/g, '')}.webp`);

/** 同一张图并发请求时只生成一次 */
const pending = new Map<string, Promise<string>>();

export async function getThumbnail(attachmentId: string, storageKey: string): Promise<string> {
  const out = thumbPath(attachmentId);
  try {
    await fs.promises.access(out);
    return out;
  } catch {
    /* 还没有，生成一张 */
  }
  let job = pending.get(out);
  if (!job) {
    job = (async () => {
      await fs.promises.mkdir(THUMB_DIR, { recursive: true });
      const tmp = `${out}.${process.pid}.tmp`;
      await sharp(resolveStorageKey(storageKey), { animated: false, limitInputPixels: 2.7e8 })
        .rotate() // 按 EXIF 方向摆正手机照片
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: 72 })
        .toFile(tmp);
      await fs.promises.rename(tmp, out);
      return out;
    })().finally(() => pending.delete(out));
    pending.set(out, job);
  }
  return job;
}

export async function removeThumbnail(attachmentId: string) {
  try {
    await fs.promises.unlink(thumbPath(attachmentId));
  } catch {
    /* 没有缩略图时忽略 */
  }
}
