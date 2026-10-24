import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, requireData, failure } from '@/lib/server/http';
import { exportPages, streamJSON } from '@/lib/server/export';
import type { Database } from '@/types/database';
export const maxDuration = 60;
type Table = keyof Database['public']['Tables'];
const accountTables: [Table, string[]][] = [
  ['profiles', ['id']],
  ['profile_preferences', ['owner_id']],
  ['couples', ['id']],
  ['couple_members', ['couple_id', 'user_id']],
  ['conversations', ['id']],
  ['upload_assets', ['id']],
  ['memories', ['id']],
  ['memory_media', ['id']],
  ['memory_favorites', ['memory_id', 'user_id']],
  ['messages', ['id']],
  ['message_reactions', ['message_id', 'user_id']],
  ['conversation_reads', ['conversation_id', 'user_id']],
  ['letters', ['id']],
  ['events', ['id']],
  ['event_responses', ['event_id', 'user_id']],
  ['daily_moods', ['id']],
  ['mood_notes', ['mood_id']],
  ['playlists', ['id']],
  ['playlist_tracks', ['id']],
  ['track_favorites', ['track_id', 'user_id']],
  ['game_sessions', ['id']],
  ['game_answers', ['session_id', 'user_id']],
  ['notifications', ['id']],
  ['notification_preferences', ['owner_id']],
];
const cycleTables: [Table, string[]][] = [
  ['profile_preferences', ['owner_id']],
  ['notification_preferences', ['owner_id']],
  ['period_records', ['id']],
  ['cycle_settings', ['owner_id']],
  ['cycle_reminders', ['id']],
  ['cycle_sharing_preferences', ['owner_id']],
];
export async function GET(request: Request) {
  try {
    const { db, user } = await requireUser();
    const scope = z
      .enum(['account', 'cycle'])
      .parse(new URL(request.url).searchParams.get('scope') || 'account');
    const metadata = {
      export_format: 1,
      exported_at: new Date().toISOString(),
      user_id: user.id,
      scope: scope === 'cycle' ? 'private-cycle' : 'account-and-authorized-shared-data',
      note: 'RLS-authorized, ordered, paginated export; not a transaction snapshot. Media bytes, auth tokens, device tokens and invitation hashes are excluded. Cycle data is available only in its separate export.',
    };
    async function* chunks() {
      yield JSON.stringify(metadata).slice(0, -1);
      for (const [table, ordering] of scope === 'cycle' ? cycleTables : accountTables) {
        yield ',' + JSON.stringify(table) + ':[';
        let first = true;
        for await (const rows of exportPages(async (offset, size) => {
          // Health-related consent flags belong to the separate health export too.
          const columns =
            table === 'profile_preferences'
              ? scope === 'cycle'
                ? 'owner_id,cycle_tracking'
                : 'owner_id,gender,layout,onboarding_completed_at'
              : table === 'notification_preferences'
                ? scope === 'cycle'
                  ? 'owner_id,cycle'
                  : 'owner_id,chat,letters,events,memories,push_enabled'
                : '*';
          let query =
            table === 'notifications'
              ? db.from('notifications').select('*').neq('category', 'cycle')
              : db.from(table).select(columns);
          for (const key of ordering) query = query.order(key);
          return requireData<unknown[] | null>(await query.range(offset, offset + size - 1));
        })) {
          yield (first ? '' : ',') + JSON.stringify(rows).slice(1, -1);
          first = false;
        }
        yield ']';
      }
      yield '}';
    }
    return new NextResponse(streamJSON(chunks()), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="him-and-i-${scope === 'cycle' ? 'private-cycle' : 'account'}.json"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return failure(error);
  }
}
