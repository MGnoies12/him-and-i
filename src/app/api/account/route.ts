import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  assertSameOrigin,
  requireUser,
  failure,
  ApiError,
  requireData,
  readJSONBody,
} from '@/lib/server/http';
import { adminSupabase } from '@/lib/server/admin';
import { limitAuth } from '@/lib/server/rate-limit';
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    limitAuth(request);
    const { db, user } = await requireUser();
    const input = z
      .object({ password: z.string().min(1).max(128), confirmation: z.literal('DELETE') })
      .parse(await readJSONBody(request, 2000));
    if (!user.email) throw new ApiError('invalid_credentials', 401);
    const { error } = await db.auth.signInWithPassword({
      email: user.email,
      password: input.password,
    });
    if (error) throw new ApiError('invalid_credentials', 401);
    const admin = adminSupabase();
    // Snapshot only a bounded first batch for immediate best-effort cleanup. The FK cascade
    // queues EVERY asset durably, including files beyond a provider's row limit.
    const assets = requireData(
      await admin
        .from('upload_assets')
        .select('storage_path')
        .eq('owner_id', user.id)
        .order('id')
        .limit(100),
    );
    const deleted = await admin.auth.admin.deleteUser(user.id);
    if (deleted.error) throw new ApiError('request_failed');
    // Delete database/auth data first. Storage failure must not leave a half-deleted live account.
    // Trusted uploads have no end-user Storage owner; older deployments must migrate that ownership.
    if (assets.length) {
      try {
        const paths = assets.map((asset) => asset.storage_path);
        const removed = await admin.storage.from('couple-media').remove(paths);
        if (!removed.error) await admin.rpc('finish_cleanup_paths', { paths });
      } catch {
        /* Durable storage_cleanup entries are retried by the scheduled worker. */
      }
    }
    await db.auth.signOut({ scope: 'local' });
    return NextResponse.json({ redirect: '/login', storageCleanup: 'durable-queue' });
  } catch (error) {
    return failure(error);
  }
}
