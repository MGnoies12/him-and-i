import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminSupabase } from '@/lib/server/admin';
import { requireUser, failure, requireData } from '@/lib/server/http';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { db } = await requireUser();
    const id = z.uuid().parse((await context.params).id);
    const asset = requireData(
      await db.from('upload_assets').select('storage_path').eq('id', id).single(),
    );
    const signed = requireData(
      await adminSupabase().storage.from('couple-media').createSignedUrl(asset.storage_path, 60),
    );
    return NextResponse.json(
      { data: { url: signed.signedUrl } },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}
