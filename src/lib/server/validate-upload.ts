import 'server-only';
import sharp from 'sharp';
import { parseBuffer } from 'music-metadata';
import { MAX_UPLOAD_BYTES } from '@/lib/media';
import { ApiError } from './http';
/** Runs before the only trusted Storage writer. Never logs private filenames or metadata. */
export async function inspectUpload(bytes: Uint8Array, mime: string, declaredDuration?: number) {
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new ApiError('file_too_large', 413);
  if (mime.startsWith('image/')) {
    try {
      const image = sharp(bytes, { limitInputPixels: 16777216, failOn: 'warning' })
        .rotate()
        .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true });
      const format = mime === 'image/jpeg' ? 'jpeg' : mime === 'image/png' ? 'png' : 'webp';
      // Sharp strips EXIF/GPS and other embedded metadata unless explicitly told to retain it.
      const result = await image.toFormat(format).toBuffer();
      if (result.byteLength > MAX_UPLOAD_BYTES) throw new ApiError('file_too_large', 413);
      return { bytes: new Uint8Array(result), duration: null };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('unsupported_media', 422);
    }
  }
  try {
    const metadata = await parseBuffer(
      bytes,
      { mimeType: mime, size: bytes.length },
      { duration: true, skipCovers: true, maxMemoryAllocation: 8 * 1024 * 1024 },
    );
    if (!metadata.format.container) throw new ApiError('unsupported_media', 422);
    if (mime.startsWith('audio/')) {
      const duration = Math.round((metadata.format.duration || 0) * 1000);
      if (
        duration < 1 ||
        duration > 120000 ||
        !declaredDuration ||
        Math.abs(duration - declaredDuration) > 750
      )
        throw new ApiError('invalid_audio', 422);
      return { bytes, duration };
    }
    return { bytes, duration: null };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('unsupported_media', 422);
  }
}
