import { NextResponse } from 'next/server';
import { z } from 'zod';
import { expandRecurring } from '@/lib/dates';
import { ApiError, failure, requireUser, unwrap } from '@/lib/server/http';
const cursorSchema = z.object({ at: z.iso.datetime({ offset: true }), id: z.uuid() });
const resourceSchema = z.enum([
  'home',
  'memories',
  'memory',
  'messages',
  'letters',
  'events',
  'moods',
  'cycle',
  'music',
  'games',
  'notifications',
  'settings',
]);
export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const resource = resourceSchema.parse((await context.params).resource);
    const { db, user } = await requireUser();
    const search = new URL(request.url).searchParams;
    const q = z
      .string()
      .max(120)
      .parse(search.get('q') || '')
      .replace(/[\\%_]/g, '\\$&');
    const cursor = search.get('cursor')
      ? cursorSchema.parse(JSON.parse(Buffer.from(search.get('cursor')!, 'base64url').toString()))
      : null;
    let data: unknown;
    switch (resource) {
      case 'home': {
        const [memories, events, moods, messages, notifications, memoryCount, letters, reads] =
          await Promise.all([
            db
              .from('memories')
              .select('*,memory_media(*,upload_assets(*)),memory_favorites(*)')
              .order('memory_date', { ascending: false })
              .limit(3),
            db
              .from('events')
              .select('*,event_responses(*)')
              .eq('status', 'planned')
              .order('starts_at')
              .limit(500),
            db
              .from('daily_moods')
              .select('*')
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
              .limit(2),
            db
              .from('messages')
              .select('*,upload_assets(*),message_reactions(*)')
              .is('deleted_at', null)
              .order('created_at', { ascending: false })
              .limit(3),
            db
              .from('notifications')
              .select('*')
              .neq('category', 'cycle')
              .is('read_at', null)
              .order('created_at', { ascending: false })
              .limit(5),
            db.from('memories').select('id', { count: 'exact', head: true }),
            db
              .from('letters')
              .select('id', { count: 'exact', head: true })
              .eq('recipient_id', user.id)
              .neq('state', 'opened'),
            db
              .from('conversation_reads')
              .select('last_read_at')
              .eq('user_id', user.id)
              .maybeSingle(),
          ]);
        const read = unwrap(reads);
        const unread = await db
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .neq('sender_id', user.id)
          .is('deleted_at', null)
          .gt('created_at', read?.last_read_at || '1970-01-01T00:00:00Z');
        unwrap(unread);
        unwrap(memoryCount);
        unwrap(letters);
        data = {
          memories: unwrap(memories),
          events: expandRecurring(
            unwrap(events) || [],
            new Date().toISOString(),
            new Date(Date.now() + 90 * 86400000).toISOString(),
          ).slice(0, 3),
          moods: unwrap(moods),
          messages: unwrap(messages),
          notifications: unwrap(notifications),
          counts: {
            memories: memoryCount.count || 0,
            letters: letters.count || 0,
            unread: unread.count || 0,
          },
        };
        break;
      }
      case 'memories': {
        const favorites =
          z
            .enum(['0', '1'])
            .optional()
            .parse(search.get('favorites') ?? undefined) === '1';
        // Filter parent rows before LIMIT/cursor pagination, not just an already-loaded page.
        // The child RLS only exposes the requesting user's own favorites.
        let query = db
          .from('memories')
          .select(
            favorites
              ? '*,memory_media(*,upload_assets(*)),memory_favorites!inner(*)'
              : '*,memory_media(*,upload_assets(*)),memory_favorites(*)',
          )
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(24);
        if (q) query = query.ilike('title', `%${q}%`);
        if (search.get('category'))
          query = query.eq(
            'category',
            z.enum(['everyday', 'date', 'travel', 'milestone']).parse(search.get('category')),
          );
        if (cursor)
          query = query.or(
            `created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`,
          );
        data = unwrap(await query);
        break;
      }
      case 'memory':
        data = unwrap(
          await db
            .from('memories')
            .select('*,memory_media(*,upload_assets(*)),memory_favorites(*)')
            .eq('id', z.uuid().parse(search.get('id')))
            .single(),
        );
        break;
      case 'messages': {
        let query = db
          .from('messages')
          .select('*,upload_assets(*),message_reactions(*)')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(40);
        if (q) query = query.ilike('body', `%${q}%`);
        if (cursor)
          query = query.or(
            `created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`,
          );
        data = {
          messages: unwrap(await query),
          reads: unwrap(await db.from('conversation_reads').select('*')),
        };
        break;
      }
      case 'letters':
        data = unwrap(
          await db
            .from('letters')
            .select('*,upload_assets(*)')
            .order('created_at', { ascending: false })
            .limit(100),
        );
        break;
      case 'events':
        data = unwrap(
          await db.from('events').select('*,event_responses(*)').order('starts_at').limit(500),
        );
        break;
      case 'moods':
        data = unwrap(
          await db
            .from('daily_moods')
            .select('*,mood_notes(*)')
            .order('created_at', { ascending: false })
            .limit(60),
        );
        break;
      case 'cycle': {
        const [records, settings, reminders, sharing, partner] = await Promise.all([
          db.from('period_records').select('*').order('start_date', { ascending: false }),
          db.from('cycle_settings').select('*').eq('owner_id', user.id).maybeSingle(),
          db.from('cycle_reminders').select('*').order('due_at'),
          db.from('cycle_sharing_preferences').select('*').eq('owner_id', user.id).maybeSingle(),
          db.rpc('get_partner_cycle_share'),
        ]);
        data = {
          records: unwrap(records),
          settings: unwrap(settings),
          reminders: unwrap(reminders),
          sharing: unwrap(sharing),
          partner: unwrap(partner),
        };
        break;
      }
      case 'music':
        data = unwrap(
          await db
            .from('playlists')
            .select('*,playlist_tracks(*,track_favorites(*))')
            .order('created_at', { ascending: false }),
        );
        break;
      case 'games':
        data = unwrap(
          await db
            .from('game_sessions')
            .select('*,game_questions(*),game_answers(*)')
            .order('created_at', { ascending: false })
            .limit(30),
        );
        break;
      case 'notifications':
        data = {
          items: unwrap(
            await db
              .from('notifications')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(100),
          ),
          preferences: unwrap(
            await db.from('notification_preferences').select('*').eq('owner_id', user.id).single(),
          ),
          devices: unwrap(
            await db
              .from('notification_subscriptions')
              .select('id,device_id,transport,created_at')
              .eq('owner_id', user.id),
          ),
        };
        break;
      case 'settings':
        data = {
          invitations: unwrap(await db.rpc('list_invitations')),
          email: user.email,
          canDeleteAccount: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        };
        break;
      default:
        throw new ApiError('not_found', 404);
    }
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return failure(error);
  }
}
