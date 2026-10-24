import { generatePairingCode, hashPairingCode } from './pairing';
import 'server-only';
import { randomBytes, createHash } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database';
import type { Action } from '@/schemas/actions';
import { ApiError, unwrap, requireData } from './http';
import { todayISO } from '@/lib/dates';
import { isAllowedPushEndpoint } from '@/lib/push';

export async function performAction(
  db: SupabaseClient<Database>,
  user: User,
  action: Action,
  origin: string,
) {
  const coupleId = unwrap(await db.rpc('current_couple')) as string | null;
  const couple = () => {
    if (!coupleId) throw new ApiError('membership_required', 403);
    return coupleId;
  };
  const conversation = async () =>
    requireData(await db.from('conversations').select('id').eq('couple_id', couple()).single()).id;
  const { type, ...payload } = action;
  void payload;
  switch (type) {
    case 'couple.create':
      return unwrap(await db.rpc('create_couple', { start_date: action.relationship_start }));
    case 'couple.update': {
      return unwrap(
        await db
          .from('couples')
          .update({ relationship_start: action.relationship_start })
          .eq('id', couple())
          .select('id')
          .single(),
      );
    }
    case 'invitation.create': {
      const token = randomBytes(32).toString('base64url');
      const hash = createHash('sha256').update(token).digest('hex');
      const result = unwrap(await db.rpc('create_invitation', { hashed_token: hash }));
      return { invitation: result, url: `${origin}/invite/${token}` };
    }
    case 'invitation.code.create': {
      const generated = generatePairingCode();
      const invitation = unwrap(
        await db.rpc('create_pairing_code', { hashed_code: generated.hash }),
      ) as unknown as { id: string; expires_at: string }[];
      return { code: generated.code, invitation: invitation[0] };
    }
    case 'invitation.code.accept':
      return unwrap(
        await db.rpc('accept_invitation', { hashed_token: hashPairingCode(action.code) }),
      );
    case 'profile.complete':
      return unwrap(
        await db.rpc('complete_profile', {
          person_name: action.fields.display_name,
          person_gender: action.fields.gender,
          chosen_layout: action.fields.layout,
          person_locale: action.fields.locale,
          person_timezone: action.fields.timezone,
          track_cycle: action.fields.cycle_tracking,
          period_start: action.fields.period_start,
          reported_length: action.fields.reported_length,
          irregular: action.fields.irregular,
        }),
      );
    case 'invitation.accept':
      return unwrap(
        await db.rpc('accept_invitation', {
          hashed_token: createHash('sha256').update(action.token).digest('hex'),
        }),
      );
    case 'invitation.revoke':
      return unwrap(await db.rpc('revoke_invitation', { invitation_id: action.id }));
    case 'memory.save':
      return unwrap(
        await db.rpc('save_memory', {
          memory_id: action.id ?? null,
          fields: action.fields,
          assets: action.assets,
        }),
      );
    case 'memory.delete':
      return unwrap(await db.from('memories').delete().eq('id', action.id).select('id').single());
    case 'memory.media.delete':
      return unwrap(
        await db.from('memory_media').delete().eq('id', action.id).select('id').single(),
      );
    case 'memory.favorite':
      return unwrap(
        action.active
          ? await db
              .from('memory_favorites')
              .upsert({ memory_id: action.id, user_id: user.id }, { ignoreDuplicates: true })
          : await db
              .from('memory_favorites')
              .delete()
              .eq('memory_id', action.id)
              .eq('user_id', user.id),
      );
    case 'message.send': {
      if (!action.body && !action.asset_id) throw new ApiError('validation_failed', 422);
      const conversation_id = await conversation();
      const result = await db
        .from('messages')
        .insert({
          id: action.id,
          conversation_id,
          sender_id: user.id,
          body: action.body,
          asset_id: action.asset_id,
          reply_to: action.reply_to,
        })
        .select('*')
        .single();
      if (result.error?.code === '23505') {
        // A retry uses the original client UUID; never duplicates a successfully persisted message.
        return unwrap(
          await db
            .from('messages')
            .select('*')
            .eq('id', action.id)
            .eq('sender_id', user.id)
            .eq('conversation_id', conversation_id)
            .single(),
        );
      }
      return unwrap(result);
    }
    case 'message.delete':
      return unwrap(await db.rpc('delete_message', { message_id: action.id }));
    case 'message.read':
      return unwrap(await db.rpc('mark_conversation_read', { target: await conversation() }));
    case 'message.react': {
      return unwrap(
        await db.rpc('set_message_reaction', { target: action.id, value: action.emoji }),
      );
    }
    case 'letter.save': {
      const fields = {
        title: action.title,
        body: action.body,
        occasion: action.occasion,
        gift_message: action.gift_message,
        asset_id: action.asset_id,
      };
      return unwrap(
        action.id
          ? await db.from('letters').update(fields).eq('id', action.id).select('id').single()
          : await db
              .from('letters')
              .insert({ ...fields, couple_id: couple(), sender_id: user.id })
              .select('id')
              .single(),
      );
    }
    case 'letter.send':
      return unwrap(
        await db.rpc('send_letter', { letter_id: action.id, release_time: action.release_at }),
      );
    case 'letter.open':
      return unwrap(await db.rpc('open_letter', { letter_id: action.id }));
    case 'letter.cancel':
      return unwrap(await db.rpc('cancel_letter', { letter_id: action.id }));
    case 'letter.delete':
      return unwrap(await db.from('letters').delete().eq('id', action.id).select('id').single());
    case 'event.save': {
      if (action.fields.ends_at && action.fields.ends_at <= action.fields.starts_at)
        throw new ApiError('invalid_date', 422);
      return unwrap(
        action.id
          ? await db.from('events').update(action.fields).eq('id', action.id).select('id').single()
          : await db
              .from('events')
              .insert({ ...action.fields, couple_id: couple(), creator_id: user.id })
              .select('id')
              .single(),
      );
    }
    case 'event.delete':
      return unwrap(await db.from('events').delete().eq('id', action.id).select('id').single());
    case 'event.rsvp': {
      return unwrap(
        await db.rpc('set_event_response', { target: action.id, value: action.response }),
      );
    }
    case 'mood.save': {
      const profile = requireData(
        await db.from('profiles').select('timezone').eq('id', user.id).single(),
      );
      return unwrap(
        await db.rpc('save_mood', {
          mood_kind: action.mood,
          private_note: action.note,
          share: action.shared,
          visible_until: new Date(Date.now() + action.visible_hours * 3600000).toISOString(),
          day: todayISO(profile.timezone),
        }),
      );
    }
    case 'mood.delete':
      return unwrap(
        await db.from('daily_moods').delete().eq('id', action.id).select('id').single(),
      );
    case 'cycle.record.save': {
      const profile = requireData(
        await db.from('profiles').select('timezone').eq('id', user.id).single(),
      );
      const today = todayISO(profile.timezone);
      if (
        action.fields.start_date > today ||
        (action.fields.end_date &&
          (action.fields.end_date < action.fields.start_date || action.fields.end_date > today))
      )
        throw new ApiError('invalid_date', 422);
      return unwrap(
        action.id
          ? await db
              .from('period_records')
              .update(action.fields)
              .eq('id', action.id)
              .select('id')
              .single()
          : await db
              .from('period_records')
              .insert({ ...action.fields, owner_id: user.id })
              .select('id')
              .single(),
      );
    }
    case 'cycle.record.delete':
      return unwrap(
        await db.from('period_records').delete().eq('id', action.id).select('id').single(),
      );
    case 'cycle.settings':
      return unwrap(
        await db.from('cycle_settings').upsert({
          owner_id: user.id,
          prediction_enabled: action.prediction_enabled,
          manual_length_confirmed: action.manual_length_confirmed,
          cycles_irregular: action.cycles_irregular,
          cycle_length: action.cycle_length,
          period_length: action.period_length,
        }),
      );
    case 'cycle.sharing':
      return unwrap(
        await db.from('cycle_sharing_preferences').upsert({
          owner_id: user.id,
          share_status: action.share_status,
          share_estimate: action.share_estimate,
          status_text: action.share_status ? action.status_text : '',
          approximate_date: action.share_estimate ? action.approximate_date : null,
          updated_at: new Date().toISOString(),
        }),
      );
    case 'cycle.reminder.save': {
      const fields = {
        kind: action.kind,
        enabled: action.enabled,
        due_at: action.due_at,
        timezone: action.timezone,
      };
      return unwrap(
        action.id
          ? await db
              .from('cycle_reminders')
              .update(fields)
              .eq('id', action.id)
              .select('id')
              .single()
          : await db
              .from('cycle_reminders')
              .insert({ ...fields, owner_id: user.id })
              .select('id')
              .single(),
      );
    }
    case 'cycle.reminder.delete':
      return unwrap(
        await db.from('cycle_reminders').delete().eq('id', action.id).select('id').single(),
      );
    case 'cycle.delete':
      return unwrap(await db.rpc('delete_cycle_data'));
    case 'playlist.create':
      return unwrap(
        await db
          .from('playlists')
          .insert({ title: action.title, couple_id: couple(), creator_id: user.id })
          .select('id')
          .single(),
      );
    case 'playlist.delete':
      return unwrap(await db.from('playlists').delete().eq('id', action.id).select('id').single());
    case 'track.add':
      return unwrap(
        await db
          .from('playlist_tracks')
          .insert({
            playlist_id: action.playlist_id,
            creator_id: user.id,
            title: action.title,
            artist: action.artist,
            url: action.url,
          })
          .select('id')
          .single(),
      );
    case 'track.delete':
      return unwrap(
        await db.from('playlist_tracks').delete().eq('id', action.id).select('id').single(),
      );
    case 'track.favorite':
      return unwrap(
        action.active
          ? await db
              .from('track_favorites')
              .upsert({ track_id: action.id, user_id: user.id }, { ignoreDuplicates: true })
          : await db
              .from('track_favorites')
              .delete()
              .eq('track_id', action.id)
              .eq('user_id', user.id),
      );
    case 'game.start':
      return unwrap(await db.rpc('start_game', { kind: action.kind }));
    case 'game.answer':
      return unwrap(await db.rpc('answer_game', { target: action.id, value: action.answer }));
    case 'game.reveal':
      return unwrap(await db.rpc('reveal_answer', { target: action.id }));
    case 'game.memory':
      return unwrap(await db.rpc('save_game_memory', { target: action.id }));
    case 'notifications.preferences': {
      unwrap(
        await db
          .from('notification_preferences')
          .upsert({ owner_id: user.id, ...action.preferences }),
      );
      if (!action.preferences.push_enabled)
        unwrap(await db.from('notification_subscriptions').delete().eq('owner_id', user.id));
      return null;
    }
    case 'notifications.read': {
      let query = db
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('owner_id', user.id)
        .is('read_at', null);
      if (action.id) query = query.eq('id', action.id);
      return unwrap(await query);
    }
    case 'notifications.subscribe': {
      if (JSON.stringify(action.subscription).length > 5000)
        throw new ApiError('validation_failed', 422);
      if (action.transport === 'web') {
        const endpoint = String(action.subscription.endpoint ?? '');
        if (!isAllowedPushEndpoint(endpoint)) throw new ApiError('unsupported_push_endpoint', 422);
        const keys = action.subscription.keys as { p256dh?: unknown; auth?: unknown } | undefined;
        if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string')
          throw new ApiError('validation_failed', 422);
      }
      return unwrap(
        await db.from('notification_subscriptions').upsert(
          {
            owner_id: user.id,
            device_id: action.device_id,
            transport: action.transport,
            subscription: action.subscription as Json,
          },
          { onConflict: 'owner_id,device_id' },
        ),
      );
    }
    case 'notifications.unsubscribe': {
      let query = db.from('notification_subscriptions').delete().eq('owner_id', user.id);
      if (action.device_id) query = query.eq('device_id', action.device_id);
      return unwrap(await query);
    }
    case 'profile.save':
      return unwrap(
        await db
          .from('profiles')
          .update({
            display_name: action.display_name,
            locale: action.locale,
            timezone: action.timezone,
          })
          .eq('id', user.id)
          .select('id')
          .single(),
      );
  }
}
