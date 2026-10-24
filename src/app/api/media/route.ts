import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  assertSameOrigin,
  requireUser,
  failure,
  unwrap,
  ApiError,
  readLimitedBytes,
} from '@/lib/server/http';
import { validateMedia, MAX_UPLOAD_BYTES } from '@/lib/media';
import { limitUserAction } from '@/lib/server/rate-limit';
import { inspectUpload } from '@/lib/server/validate-upload';
import { adminSupabase } from '@/lib/server/admin';
import type { Asset } from '@/types/models';
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (Number(request.headers.get('content-length') || 0) > MAX_UPLOAD_BYTES + 65536)
      throw new ApiError('file_too_large', 413);
    const { db, user } = await requireUser();
    limitUserAction(user.id, 'upload');
    const bounded = await readLimitedBytes(request, MAX_UPLOAD_BYTES + 65536);
    const form = await new Request(request.url, {
      method: 'POST',
      headers: { 'content-type': request.headers.get('content-type') || '' },
      body: bounded,
    }).formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new ApiError('validation_failed', 422);
    const kind = z.enum(['memory', 'chat', 'letter']).parse(form.get('kind'));
    const duration = form.get('duration')
      ? z.coerce.number().int().min(1).max(120000).parse(form.get('duration'))
      : undefined;
    let media: ReturnType<typeof validateMedia>;
    try {
      media = validateMedia(
        file.name,
        file.type,
        file.size,
        new Uint8Array(await file.slice(0, 32).arrayBuffer()),
        kind,
        duration,
      );
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : 'unsupported_media', 422);
    }
    const admin = adminSupabase();
    const inspected = await inspectUpload(
      new Uint8Array(await file.arrayBuffer()),
      media.mime,
      duration,
    );
    const asset = unwrap(
      await db.rpc('reserve_upload', {
        asset_kind: kind,
        extension: media.extension,
        mime: media.mime,
        size_bytes: inspected.bytes.length,
        duration: inspected.duration,
      }),
    ) as unknown as Asset;
    const uploaded = await admin.storage
      .from('couple-media')
      .upload(asset.storage_path, inspected.bytes, {
        contentType: media.mime,
        upsert: false,
        cacheControl: '60',
      });
    if (uploaded.error) {
      await db.from('upload_assets').delete().eq('id', asset.id);
      throw new ApiError('upload_failed');
    }
    return NextResponse.json({ data: asset });
  } catch (error) {
    return failure(error);
  }
}
