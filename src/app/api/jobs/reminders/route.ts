import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';
import { adminSupabase } from '@/lib/server/admin';
import { ApiError, failure, unwrap, requireData } from '@/lib/server/http';
import { isAllowedPushEndpoint } from '@/lib/push';
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const expected = process.env.CRON_SECRET;
    const provided = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
    if (!expected || expected.length < 32) throw new ApiError('server_configuration_required', 503);
    if (
      Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
    )
      throw new ApiError('forbidden', 403);
    const deadline = Date.now() + 45000;
    const db = adminSupabase();
    const processed = unwrap(await db.rpc('process_due_reminders', { batch_size: 100 }));
    const cleanup = unwrap(await db.rpc('cleanup_batch')) as unknown as { storage_path: string }[];
    if (cleanup.length) {
      const paths = cleanup.map((item) => item.storage_path);
      const { error } = await db.storage.from('couple-media').remove(paths);
      unwrap(await db.rpc('finish_cleanup_paths', { paths, success: !error }));
    }
    let delivered = 0;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      privateKey = process.env.VAPID_PRIVATE_KEY,
      subject = process.env.VAPID_SUBJECT;
    if (publicKey && privateKey && subject) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      const batch = unwrap(await db.rpc('claim_push_batch', { batch_size: 30 })) as unknown as {
        notification_id: string;
        owner_id: string;
      }[];
      for (const item of batch) {
        if (Date.now() > deadline) {
          unwrap(await db.rpc('finish_push', { target: item.notification_id, result: 'pending' }));
          continue;
        }
        const notice = unwrap(
          await db.from('notifications').select('*').eq('id', item.notification_id).maybeSingle(),
        );
        if (!notice) continue;
        const pref = unwrap(
          await db
            .from('notification_preferences')
            .select('*')
            .eq('owner_id', item.owner_id)
            .maybeSingle(),
        );
        if (
          !pref?.push_enabled ||
          !pref[notice.category as 'chat' | 'letters' | 'events' | 'memories' | 'cycle']
        ) {
          unwrap(await db.rpc('finish_push', { target: item.notification_id, result: 'skipped' }));
          continue;
        }
        const devices = requireData(
          await db
            .from('notification_subscriptions')
            .select('*')
            .eq('owner_id', item.owner_id)
            .eq('transport', 'web'),
        );
        let retry = false,
          sent = false;
        for (const device of devices) {
          if (Date.now() > deadline) {
            retry = true;
            break;
          }
          const subscription = device.subscription as unknown as webpush.PushSubscription;
          if (!subscription?.endpoint || !isAllowedPushEndpoint(subscription.endpoint)) continue;
          try {
            await webpush.sendNotification(
              subscription,
              JSON.stringify({
                title: 'HIM & I',
                body: 'A little update in your private space.',
                url: '/notifications',
                id: item.notification_id,
              }),
              { TTL: 3600, timeout: 5000 },
            );
            sent = true;
            delivered++;
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410)
              await db.from('notification_subscriptions').delete().eq('id', device.id);
            else retry = true;
          }
        }
        unwrap(
          await db.rpc('finish_push', {
            target: item.notification_id,
            result: retry ? 'pending' : sent ? 'sent' : 'skipped',
          }),
        );
      }
    }
    return NextResponse.json({
      processed,
      cleanupAttempted: cleanup.length,
      delivered,
      pushConfigured: !!(publicKey && privateKey && subject),
    });
  } catch (error) {
    return failure(error);
  }
}
