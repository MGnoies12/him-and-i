-- HIM & I. All dates/timestamps are date / timestamptz; no client-supplied identity is trusted.
-- This migration is also executed against PostgreSQL WASM in the authorization test suite.
begin;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema public to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  locale text not null default 'fa' check (locale in ('fa','en')),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);
create table public.couples (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  relationship_start date check (relationship_start >= date '1900-01-01'),
  created_at timestamptz not null default now()
);
create table public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  slot smallint not null check (slot in (1,2)),
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id), unique (couple_id, slot)
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default now() + interval '48 hours',
  revoked_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index invitations_couple_idx on public.invitations(couple_id, created_at desc);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null unique references public.couples(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.upload_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  kind text not null check (kind in ('memory','chat','letter')),
  storage_path text not null unique,
  mime_type text not null,
  bytes integer not null check (bytes > 0 and bytes <= 20971520),
  duration_ms integer check (duration_ms between 1 and 120000),
  created_at timestamptz not null default now()
);
create index upload_assets_owner_idx on public.upload_assets(owner_id, created_at);
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 10000),
  memory_date date not null,
  location text check (char_length(location) <= 200),
  category text not null default 'everyday' check (category in ('everyday','date','travel','milestone')),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  music_url text check (music_url is null or (music_url ~ '^https://' and char_length(music_url) <= 2048)),
  created_at timestamptz not null default now()
);
create index memories_timeline_idx on public.memories(couple_id, memory_date desc, id);
create table public.memory_media (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  asset_id uuid not null unique references public.upload_assets(id) on delete cascade,
  position smallint not null default 0 check (position between 0 and 7)
);
create index memory_media_parent_idx on public.memory_media(memory_id);
create table public.memory_favorites (
  memory_id uuid not null references public.memories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (memory_id, user_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  asset_id uuid unique references public.upload_assets(id) on delete set null,
  reply_to uuid references public.messages(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (body <> '' or asset_id is not null or deleted_at is not null)
);
create index messages_history_idx on public.messages(conversation_id, created_at desc, id);
create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('heart','smile','sparkles','hug')),
  primary key (message_id, user_id)
);
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table public.letters (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 20000),
  occasion text check (char_length(occasion) <= 100),
  gift_message text check (char_length(gift_message) <= 500),
  asset_id uuid unique references public.upload_assets(id) on delete set null,
  state text not null default 'draft' check (state in ('draft','scheduled','available','opened','cancelled')),
  release_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  check (recipient_id is null or recipient_id <> sender_id),
  check (state in ('draft','cancelled') or (recipient_id is not null and release_at is not null)),
  check ((state = 'opened') = (opened_at is not null))
);
create index letters_release_idx on public.letters(release_at) where state = 'scheduled';
create index letters_couple_idx on public.letters(couple_id, created_at desc);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null,
  all_day boolean not null default false,
  location text check (char_length(location) <= 200),
  recurrence text check (recurrence in ('FREQ=WEEKLY','FREQ=MONTHLY')),
  status text not null default 'planned' check (status in ('planned','done')),
  reminder_enabled boolean not null default false,
  next_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index events_upcoming_idx on public.events(couple_id, starts_at);
create index events_reminder_idx on public.events(next_reminder_at) where reminder_enabled;
create table public.event_responses (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  response text not null check (response in ('yes','maybe','no')),
  primary key (event_id, user_id)
);
create table public.daily_moods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  couple_id uuid references public.couples(id) on delete cascade,
  local_date date not null,
  mood text not null check (mood in ('happy','calm','missing','tired','sad','stressed','space','support')),
  shared boolean not null default false,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (owner_id, local_date)
);
create index moods_shared_idx on public.daily_moods(couple_id, expires_at) where shared;
-- Notes intentionally live in a separate owner-only table: row visibility never leaks a private note.
create table public.mood_notes (
  mood_id uuid primary key references public.daily_moods(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  note text not null check (char_length(note) <= 2000)
);
create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now()
);
create index playlists_couple_idx on public.playlists(couple_id);
create table public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  artist text not null check (char_length(artist) between 1 and 120),
  url text not null check (url ~ '^https://' and char_length(url) <= 2048),
  created_at timestamptz not null default now()
);
create index tracks_playlist_idx on public.playlist_tracks(playlist_id, created_at desc);
create table public.track_favorites (
  track_id uuid not null references public.playlist_tracks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (track_id, user_id)
);
create table public.game_questions (
  id uuid primary key default gen_random_uuid(),
  game_type text not null check (game_type in ('know','choice','daily')),
  question_fa text not null,
  question_en text not null,
  options_fa text[],
  options_en text[]
);
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  creator_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.game_questions(id),
  game_type text not null check (game_type in ('know','choice','daily')),
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index games_active_idx on public.game_sessions(couple_id, game_type) where not closed;
create table public.game_answers (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  answer text not null check (char_length(answer) between 1 and 2000),
  reveal_consent boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
create table public.notification_preferences (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  chat boolean not null default true,
  letters boolean not null default true,
  events boolean not null default true,
  memories boolean not null default false,
  cycle boolean not null default false,
  push_enabled boolean not null default false
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('chat','letters','events','memories','cycle')),
  kind text not null check (kind in ('message','letter','event','memory','private_reminder')),
  href text not null check (href in ('/chat','/letters','/calendar','/memories','/cycle')),
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, dedupe_key)
);
create index notifications_owner_idx on public.notifications(owner_id, created_at desc);
create table public.notification_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null,
  transport text not null check (transport in ('web','fcm','apns')),
  subscription jsonb not null check (octet_length(subscription::text) <= 5000),
  created_at timestamptz not null default now(),
  unique (owner_id, device_id)
);
-- Health data never inherits a couple membership policy.
create table public.cycle_settings (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  prediction_enabled boolean not null default false,
  cycle_length integer not null default 28 check (cycle_length between 15 and 90),
  period_length integer not null default 5 check (period_length between 1 and 15)
);
create table public.period_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date,
  symptoms text[] not null default '{}' check (cardinality(symptoms) <= 12),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  unique (owner_id, start_date),
  check (end_date is null or (end_date >= start_date and end_date <= start_date + 30))
);
create index periods_owner_idx on public.period_records(owner_id, start_date desc);
create table public.cycle_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('log','estimate','supplies')),
  enabled boolean not null default false,
  due_at timestamptz not null,
  timezone text not null,
  created_at timestamptz not null default now()
);
create index cycle_reminder_due_idx on public.cycle_reminders(due_at) where enabled;
create table public.cycle_sharing_preferences (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  share_status boolean not null default false,
  share_estimate boolean not null default false,
  status_text text not null default '' check (char_length(status_text) <= 80),
  approximate_date date,
  updated_at timestamptz not null default now()
);
create table app_private.rate_windows (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  hits integer not null,
  primary key (owner_id, action, window_start)
);
create table app_private.storage_cleanup (
  storage_path text primary key,
  created_at timestamptz not null default now(),
  attempts integer not null default 0
);
create table app_private.push_outbox (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','sending','sent','skipped','failed')),
  attempts integer not null default 0,
  locked_at timestamptz
);

create function public.current_couple() returns uuid language sql stable security definer set search_path = '' as $$
  select couple_id from public.couple_members where user_id = auth.uid()
$$;
create function public.is_member(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.couple_members where couple_id = target and user_id = auth.uid())
$$;
create function public.are_partners(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.couple_members a join public.couple_members b on a.couple_id=b.couple_id where a.user_id=auth.uid() and b.user_id=target)
$$;
create function public.can_chat(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.conversations where id=target and public.is_member(couple_id))
$$;
create function app_private.check_rate(action_name text, max_hits integer, seconds integer) returns void language plpgsql security definer set search_path = '' as $$
declare count_hits integer;
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  insert into app_private.rate_windows(owner_id, action, window_start, hits)
  values(auth.uid(), action_name, to_timestamp(floor(extract(epoch from clock_timestamp()) / seconds) * seconds), 1)
  on conflict (owner_id, action, window_start) do update set hits=app_private.rate_windows.hits+1 returning hits into count_hits;
  if count_hits > max_hits then raise exception 'rate_limited'; end if;
end $$;
create function app_private.guard_identity() returns trigger language plpgsql set search_path = '' as $$
declare col text;
begin
  if tg_op = 'INSERT' then
    if to_jsonb(new) ? 'created_at' then new := jsonb_populate_record(new, jsonb_build_object('created_at', now())); end if;
    return new;
  end if;
  foreach col in array array['id','owner_id','creator_id','sender_id','user_id','couple_id','conversation_id','created_at','memory_id','playlist_id','session_id','message_id','event_id'] loop
    if to_jsonb(old) ? col and (to_jsonb(new)->col) is distinct from (to_jsonb(old)->col) then raise exception 'immutable_identity'; end if;
  end loop;
  return new;
end $$;
create function app_private.validate_timezone() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'invalid_timezone'; end if;
  return new;
end $$;
create function app_private.bootstrap_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),60));
  insert into public.notification_preferences(owner_id) values(new.id);
  insert into public.cycle_settings(owner_id) values(new.id);
  insert into public.cycle_sharing_preferences(owner_id) values(new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function app_private.bootstrap_user();

create function public.create_couple(start_date date default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform app_private.check_rate('create_couple', 3, 3600);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if public.current_couple() is not null then raise exception 'already_member'; end if;
  if start_date > current_date then raise exception 'invalid_date'; end if;
  insert into public.couples(created_by,relationship_start) values(auth.uid(),start_date) returning id into result;
  insert into public.couple_members(couple_id,user_id,slot) values(result,auth.uid(),1);
  insert into public.conversations(couple_id) values(result);
  return result;
end $$;
create function public.create_invitation(hashed_token text) returns table(id uuid, expires_at timestamptz) language plpgsql security definer set search_path = '' as $$
declare target uuid := public.current_couple();
begin
  perform app_private.check_rate('invite', 5, 3600);
  perform 1 from public.couples where couples.id=target for update;
  if target is null or (select count(*) from public.couple_members where couple_id=target) >= 2 then raise exception 'couple_full'; end if;
  update public.invitations set revoked_at=now() where couple_id=target and accepted_at is null and revoked_at is null;
  return query insert into public.invitations(couple_id,inviter_id,token_hash) values(target,auth.uid(),hashed_token) returning invitations.id,invitations.expires_at;
end $$;
create function public.accept_invitation(hashed_token text) returns uuid language plpgsql security definer set search_path = '' as $$
declare invite public.invitations; available_slot smallint;
begin
  perform app_private.check_rate('accept_invite', 15, 3600);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into invite from public.invitations where token_hash=hashed_token for update;
  if invite.id is null or invite.revoked_at is not null or invite.accepted_at is not null or invite.expires_at <= now() then raise exception 'invalid_invitation'; end if;
  if public.current_couple() is not null then raise exception 'already_member'; end if;
  perform 1 from public.couples where id=invite.couple_id for update;
  if not exists(select 1 from public.couple_members where couple_id=invite.couple_id and user_id=invite.inviter_id) then raise exception 'invalid_invitation'; end if;
  select s::smallint into available_slot from generate_series(1,2) s where not exists(select 1 from public.couple_members where couple_id=invite.couple_id and slot=s) order by s limit 1;
  if available_slot is null then raise exception 'couple_full'; end if;
  insert into public.couple_members(couple_id,user_id,slot) values(invite.couple_id,auth.uid(),available_slot);
  update public.invitations set accepted_at=now(), accepted_by=auth.uid() where id=invite.id;
  return invite.couple_id;
end $$;
create function public.revoke_invitation(invitation_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.invitations set revoked_at=now() where id=invitation_id and inviter_id=auth.uid() and accepted_at is null;
  if not found then raise exception 'not_found'; end if;
end $$;
create function public.list_invitations() returns table(id uuid,expires_at timestamptz,revoked_at timestamptz,accepted_at timestamptz) language sql stable security definer set search_path = '' as $$
  select id,expires_at,revoked_at,accepted_at from public.invitations where inviter_id=auth.uid() and couple_id=public.current_couple() order by created_at desc limit 10
$$;

create function public.reserve_upload(asset_kind text, extension text, mime text, size_bytes integer, duration integer default null) returns public.upload_assets language plpgsql security definer set search_path = '' as $$
declare result public.upload_assets; asset_id uuid := gen_random_uuid(); target uuid := public.current_couple();
begin
  perform app_private.check_rate('upload', 30, 3600);
  if target is null then raise exception 'membership_required'; end if;
  if not ((extension='jpg' and mime='image/jpeg') or (extension='png' and mime='image/png') or (extension='webp' and mime='image/webp') or (extension='mp4' and mime='video/mp4') or (extension='webm' and mime in ('video/webm','audio/webm')) or (extension='ogg' and mime='audio/ogg') or (extension='m4a' and mime='audio/mp4') or (extension='wav' and mime='audio/wav')) then raise exception 'unsupported_media'; end if;
  if mime like 'audio/%' and (asset_kind <> 'chat' or duration is null) then raise exception 'invalid_audio'; end if;
  if asset_kind='letter' and mime not like 'image/%' then raise exception 'unsupported_media'; end if;
  insert into public.upload_assets(id,owner_id,couple_id,kind,storage_path,mime_type,bytes,duration_ms)
    values(asset_id,auth.uid(),target,asset_kind,auth.uid()::text || '/' || asset_id::text || '.' || extension,mime,size_bytes,duration) returning * into result;
  return result;
end $$;
create function app_private.validate_asset(target uuid, expected_kind text, expected_couple uuid, expected_owner uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if target is not null and not exists(select 1 from public.upload_assets where id=target and owner_id=expected_owner and couple_id=expected_couple and kind=expected_kind) then raise exception 'invalid_attachment'; end if;
end $$;
create function app_private.memory_attachment() returns trigger language plpgsql security definer set search_path = '' as $$
declare parent public.memories;
begin
  select * into parent from public.memories where id=new.memory_id;
  perform app_private.validate_asset(new.asset_id,'memory',parent.couple_id,parent.creator_id);
  if (select count(*) from public.memory_media where memory_id=new.memory_id) >= 8 then raise exception 'too_many_files'; end if;
  return new;
end $$;
create trigger validate_memory_attachment before insert on public.memory_media for each row execute function app_private.memory_attachment();
create function app_private.message_insert() returns trigger language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if new.deleted_at is not null then raise exception 'invalid_message'; end if;
  perform app_private.check_rate('message', 40, 60);
  select couple_id into target from public.conversations where id=new.conversation_id;
  perform app_private.validate_asset(new.asset_id,'chat',target,new.sender_id);
  if new.reply_to is not null and not exists(select 1 from public.messages where id=new.reply_to and conversation_id=new.conversation_id) then raise exception 'invalid_reply'; end if;
  return new;
end $$;
create trigger validate_message before insert on public.messages for each row execute function app_private.message_insert();
create function public.delete_message(message_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare asset uuid;
begin
  select asset_id into asset from public.messages where id=message_id and sender_id=auth.uid() and public.can_chat(conversation_id) for update;
  if not found then raise exception 'not_found'; end if;
  update public.messages set body='',asset_id=null,deleted_at=now() where id=message_id;
  delete from public.message_reactions where message_reactions.message_id=delete_message.message_id;
  if asset is not null then delete from public.upload_assets where id=asset; end if;
end $$;
create function public.mark_conversation_read(target uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_chat(target) then raise exception 'forbidden'; end if;
  insert into public.conversation_reads(conversation_id,user_id,last_read_at) values(target,auth.uid(),now()) on conflict (conversation_id,user_id) do update set last_read_at=now();
end $$;
create function app_private.letter_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.validate_asset(new.asset_id,'letter',new.couple_id,new.sender_id);
  if tg_op='INSERT' and (new.state <> 'draft' or new.recipient_id is not null or new.release_at is not null or new.opened_at is not null) then raise exception 'invalid_letter_state'; end if;
  if tg_op='UPDATE' and old.state <> 'draft' and (new.body<>old.body or new.title<>old.title or new.occasion is distinct from old.occasion or new.gift_message is distinct from old.gift_message or new.release_at is distinct from old.release_at or new.recipient_id is distinct from old.recipient_id) then raise exception 'letter_locked'; end if;
  return new;
end $$;
create trigger validate_letter before insert or update on public.letters for each row execute function app_private.letter_guard();
create function public.send_letter(letter_id uuid, release_time timestamptz) returns void language plpgsql security definer set search_path = '' as $$
declare item public.letters; partner uuid;
begin
  perform app_private.check_rate('letter', 15, 3600);
  select * into item from public.letters where id=letter_id and sender_id=auth.uid() and public.is_member(couple_id) for update;
  if item.id is null or item.state<>'draft' then raise exception 'invalid_letter_state'; end if;
  select user_id into partner from public.couple_members where couple_id=item.couple_id and user_id<>auth.uid();
  if partner is null then raise exception 'partner_required'; end if;
  if release_time is null or release_time > now()+interval '5 years' then raise exception 'invalid_date'; end if;
  update public.letters set recipient_id=partner,release_at=greatest(release_time,now()),state=case when release_time>now() then 'scheduled' else 'available' end where id=letter_id;
end $$;
create function public.open_letter(letter_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.letters set state='opened',opened_at=now() where id=letter_id and recipient_id=auth.uid() and public.is_member(couple_id) and state in ('scheduled','available') and release_at<=now();
  if not found then raise exception 'letter_unavailable'; end if;
end $$;
create function public.cancel_letter(letter_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.letters set state='cancelled' where id=letter_id and sender_id=auth.uid() and public.is_member(couple_id) and state in ('draft','scheduled');
  if not found then raise exception 'invalid_letter_state'; end if;
end $$;
create function app_private.event_schedule() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='INSERT' or new.starts_at<>old.starts_at or new.reminder_enabled<>old.reminder_enabled then
    new.next_reminder_at := case when new.reminder_enabled then new.starts_at - interval '1 hour' else null end;
  end if;
  return new;
end $$;
create trigger event_schedule before insert or update on public.events for each row execute function app_private.event_schedule();
create function app_private.mood_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.expires_at > now()+interval '7 days' or new.expires_at <= now() then raise exception 'invalid_expiry'; end if;
  return new;
end $$;
create trigger mood_expiry before insert or update on public.daily_moods for each row execute function app_private.mood_guard();
create function public.save_mood(mood_kind text, private_note text, share boolean, visible_until timestamptz, day date) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform app_private.check_rate('mood', 30, 3600);
  insert into public.daily_moods(owner_id,couple_id,local_date,mood,shared,expires_at) values(auth.uid(),public.current_couple(),day,mood_kind,share,visible_until)
  on conflict(owner_id,local_date) do update set mood=excluded.mood,shared=excluded.shared,expires_at=excluded.expires_at returning id into result;
  insert into public.mood_notes(mood_id,owner_id,note) values(result,auth.uid(),private_note) on conflict(mood_id) do update set note=excluded.note;
  return result;
end $$;
create function public.get_partner_cycle_share() returns table(owner_id uuid, status_text text, approximate_date date) language sql stable security definer set search_path = '' as $$
  select p.owner_id,case when p.share_status then p.status_text else null end,case when p.share_estimate then p.approximate_date else null end
  from public.cycle_sharing_preferences p where p.owner_id<>auth.uid() and public.are_partners(p.owner_id) and (p.share_status or p.share_estimate)
$$;
create function public.delete_cycle_data() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  delete from public.period_records where owner_id=auth.uid();
  delete from public.cycle_reminders where owner_id=auth.uid();
  delete from public.notifications where owner_id=auth.uid() and category='cycle';
  update public.cycle_settings set prediction_enabled=false,cycle_length=28,period_length=5 where owner_id=auth.uid();
  update public.cycle_sharing_preferences set share_status=false,share_estimate=false,status_text='',approximate_date=null,updated_at=now() where owner_id=auth.uid();
  update public.notification_preferences set cycle=false where owner_id=auth.uid();
end $$;
create function public.game_revealed(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.game_sessions s where s.id=target and public.is_member(s.couple_id) and (select count(*) from public.game_answers a where a.session_id=s.id and a.reveal_consent)=2)
$$;
create function public.start_game(kind text) returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid:=public.current_couple(); existing uuid; question uuid; result uuid;
begin
  perform app_private.check_rate('game', 30, 3600);
  if target is null then raise exception 'membership_required'; end if;
  perform 1 from public.couples where id=target for update;
  select id into existing from public.game_sessions where couple_id=target and game_type=kind and not closed;
  if existing is not null and not public.game_revealed(existing) then return existing; end if;
  if kind='daily' and exists(select 1 from public.game_sessions where couple_id=target and game_type='daily' and created_at::date=current_date) then
    return (select id from public.game_sessions where couple_id=target and game_type='daily' and created_at::date=current_date order by created_at desc limit 1);
  end if;
  if existing is not null then update public.game_sessions set closed=true where id=existing; end if;
  select id into question from public.game_questions where game_type=kind order by random() limit 1;
  if question is null then raise exception 'invalid_game'; end if;
  insert into public.game_sessions(couple_id,creator_id,question_id,game_type) values(target,auth.uid(),question,kind) returning id into result;
  return result;
end $$;
create function public.answer_game(target uuid, value text) returns void language plpgsql security definer set search_path = '' as $$
declare item public.game_sessions;
begin
  perform app_private.check_rate('answer', 40, 3600);
  select * into item from public.game_sessions where id=target and public.is_member(couple_id) for update;
  if item.id is null or item.closed then raise exception 'invalid_game'; end if;
  if item.game_type='choice' and value not in ('0','1') then raise exception 'invalid_answer'; end if;
  insert into public.game_answers(session_id,user_id,answer,reveal_consent) values(target,auth.uid(),value,item.game_type<>'daily');
end $$;
create function public.reveal_answer(target uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.game_sessions where id=target and public.is_member(couple_id)) then raise exception 'forbidden'; end if;
  update public.game_answers set reveal_consent=true where session_id=target and user_id=auth.uid();
end $$;
create function public.save_game_memory(target uuid) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; body text; item public.game_sessions; title text;
begin
  if not public.game_revealed(target) then raise exception 'answers_private'; end if;
  perform app_private.check_rate('game_memory', 10, 3600);
  select * into item from public.game_sessions where id=target;
  select case when (select locale from public.profiles where id=auth.uid())='fa' then question_fa else question_en end into title from public.game_questions where id=item.question_id;
  select string_agg(p.display_name || ': ' || a.answer, E'\n\n' order by a.created_at) into body from public.game_answers a join public.profiles p on p.id=a.user_id where session_id=target;
  insert into public.memories(couple_id,creator_id,title,description,memory_date) values(item.couple_id,auth.uid(),left(title,120),body,current_date) returning id into result;
  return result;
end $$;
create function public.can_read_asset(target uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.upload_assets a where a.id=target and (
    a.owner_id=auth.uid() or (
      public.is_member(a.couple_id) and (
        (a.kind='memory' and exists(select 1 from public.memory_media mm join public.memories m on m.id=mm.memory_id where mm.asset_id=a.id and public.is_member(m.couple_id))) or
        (a.kind='chat' and exists(select 1 from public.messages m where m.asset_id=a.id and m.deleted_at is null and public.can_chat(m.conversation_id))) or
        (a.kind='letter' and exists(select 1 from public.letters l where l.asset_id=a.id and l.recipient_id=auth.uid() and l.state in ('scheduled','available','opened') and l.release_at<=now()))
      )
    )
  ))
$$;
create function public.can_read_storage(path text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.upload_assets where storage_path=path and public.can_read_asset(id))
$$;
create function public.can_write_storage(path text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.upload_assets where storage_path=path and owner_id=auth.uid() and public.is_member(couple_id) and created_at>now()-interval '1 hour')
$$;
create function app_private.cleanup_asset() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into app_private.storage_cleanup(storage_path) values(old.storage_path) on conflict do nothing;
  return old;
end $$;
create trigger cleanup_deleted_asset after delete on public.upload_assets for each row execute function app_private.cleanup_asset();
create function app_private.cleanup_link() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.asset_id is not null then delete from public.upload_assets where id=old.asset_id; end if;
  return old;
end $$;
create trigger cleanup_memory_media after delete on public.memory_media for each row execute function app_private.cleanup_link();
create trigger cleanup_letter_media after delete on public.letters for each row execute function app_private.cleanup_link();
create trigger cleanup_message_media after delete on public.messages for each row execute function app_private.cleanup_link();

-- Enable RLS before granting any API access. No anonymous access to any application table.
do $$ declare t text; begin
  foreach t in array array['profiles','couples','couple_members','invitations','conversations','upload_assets','memories','memory_media','memory_favorites','messages','message_reactions','conversation_reads','letters','events','event_responses','daily_moods','mood_notes','playlists','playlist_tracks','track_favorites','game_questions','game_sessions','game_answers','notification_preferences','notifications','notification_subscriptions','cycle_settings','period_records','cycle_reminders','cycle_sharing_preferences'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
  end loop;
  foreach t in array array['profiles','couples','upload_assets','memories','messages','letters','events','daily_moods','playlists','playlist_tracks','game_sessions','period_records','cycle_reminders','notification_subscriptions'] loop
    execute format('create trigger protect_identity before insert or update on public.%I for each row execute function app_private.guard_identity()',t);
  end loop;
  foreach t in array array['profiles','events','cycle_reminders'] loop
    execute format('create trigger valid_timezone before insert or update on public.%I for each row execute function app_private.validate_timezone()',t);
  end loop;
end $$;
create policy profile_read on public.profiles for select to authenticated using (id=auth.uid() or public.are_partners(id));
create policy profile_update on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
grant select on public.profiles to authenticated;
grant update(display_name,locale,timezone) on public.profiles to authenticated;
create policy couple_read on public.couples for select to authenticated using (public.is_member(id));
create policy couple_update on public.couples for update to authenticated using (public.is_member(id)) with check (public.is_member(id));
grant select on public.couples to authenticated;
grant update(relationship_start) on public.couples to authenticated;
create policy member_read on public.couple_members for select to authenticated using (public.is_member(couple_id));
grant select on public.couple_members to authenticated;
-- invitations deliberately have no select/write grants. Hashes are never exposed.
create policy conversation_read on public.conversations for select to authenticated using (public.is_member(couple_id));
grant select on public.conversations to authenticated;
create policy asset_read on public.upload_assets for select to authenticated using (public.can_read_asset(id));
create policy asset_delete on public.upload_assets for delete to authenticated using (owner_id=auth.uid());
grant select,delete on public.upload_assets to authenticated;
create policy memory_read on public.memories for select to authenticated using (public.is_member(couple_id));
create policy memory_insert on public.memories for insert to authenticated with check (creator_id=auth.uid() and public.is_member(couple_id));
create policy memory_update on public.memories for update to authenticated using (creator_id=auth.uid() and public.is_member(couple_id)) with check (creator_id=auth.uid() and public.is_member(couple_id));
create policy memory_delete on public.memories for delete to authenticated using (creator_id=auth.uid() and public.is_member(couple_id));
grant select,insert,delete on public.memories to authenticated;
grant update(title,description,memory_date,location,category,tags,music_url) on public.memories to authenticated;
create policy media_read on public.memory_media for select to authenticated using (exists(select 1 from public.memories where id=memory_id and public.is_member(couple_id)));
create policy media_insert on public.memory_media for insert to authenticated with check (exists(select 1 from public.memories where id=memory_id and creator_id=auth.uid() and public.is_member(couple_id)));
create policy media_delete on public.memory_media for delete to authenticated using (exists(select 1 from public.memories where id=memory_id and creator_id=auth.uid() and public.is_member(couple_id)));
grant select,insert,delete on public.memory_media to authenticated;
create policy memory_favorite_read on public.memory_favorites for select to authenticated using (user_id=auth.uid());
create policy memory_favorite_insert on public.memory_favorites for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.memories where id=memory_id and public.is_member(couple_id)));
create policy memory_favorite_delete on public.memory_favorites for delete to authenticated using (user_id=auth.uid());
grant select,insert,delete on public.memory_favorites to authenticated;
create policy message_read on public.messages for select to authenticated using (public.can_chat(conversation_id));
create policy message_insert on public.messages for insert to authenticated with check (sender_id=auth.uid() and public.can_chat(conversation_id));
grant select,insert on public.messages to authenticated;
create policy reaction_read on public.message_reactions for select to authenticated using (exists(select 1 from public.messages where id=message_id and public.can_chat(conversation_id)));
create policy reaction_insert on public.message_reactions for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.messages where id=message_id and deleted_at is null and public.can_chat(conversation_id)));
create policy reaction_delete on public.message_reactions for delete to authenticated using (user_id=auth.uid());
grant select,insert,delete on public.message_reactions to authenticated;
create policy reads_read on public.conversation_reads for select to authenticated using (public.can_chat(conversation_id));
grant select on public.conversation_reads to authenticated;
create policy letter_read on public.letters for select to authenticated using (public.is_member(couple_id) and (sender_id=auth.uid() or (recipient_id=auth.uid() and state in ('scheduled','available','opened') and release_at<=now())));
create policy letter_insert on public.letters for insert to authenticated with check (sender_id=auth.uid() and public.is_member(couple_id) and state='draft');
create policy letter_update on public.letters for update to authenticated using (sender_id=auth.uid() and public.is_member(couple_id) and state='draft') with check (sender_id=auth.uid() and state='draft');
create policy letter_delete on public.letters for delete to authenticated using (sender_id=auth.uid() and public.is_member(couple_id) and state in ('draft','cancelled'));
grant select,insert,delete on public.letters to authenticated;
grant update(title,body,occasion,gift_message,asset_id) on public.letters to authenticated;
create policy event_read on public.events for select to authenticated using (public.is_member(couple_id));
create policy event_insert on public.events for insert to authenticated with check (creator_id=auth.uid() and public.is_member(couple_id));
create policy event_update on public.events for update to authenticated using (creator_id=auth.uid() and public.is_member(couple_id)) with check (creator_id=auth.uid() and public.is_member(couple_id));
create policy event_delete on public.events for delete to authenticated using (creator_id=auth.uid() and public.is_member(couple_id));
grant select,insert,delete on public.events to authenticated;
grant update(title,description,starts_at,ends_at,timezone,all_day,location,recurrence,status,reminder_enabled) on public.events to authenticated;
create policy rsvp_read on public.event_responses for select to authenticated using (exists(select 1 from public.events where id=event_id and public.is_member(couple_id)));
create policy rsvp_write on public.event_responses for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.events where id=event_id and public.is_member(couple_id)));
create policy rsvp_delete on public.event_responses for delete to authenticated using (user_id=auth.uid());
grant select,insert,delete on public.event_responses to authenticated;
create policy mood_read on public.daily_moods for select to authenticated using (owner_id=auth.uid() or (shared and expires_at>now() and public.is_member(couple_id)));
create policy mood_delete on public.daily_moods for delete to authenticated using (owner_id=auth.uid());
grant select,delete on public.daily_moods to authenticated;
create policy mood_note_read on public.mood_notes for select to authenticated using (owner_id=auth.uid());
grant select on public.mood_notes to authenticated;
create policy playlist_read on public.playlists for select to authenticated using (public.is_member(couple_id));
create policy playlist_insert on public.playlists for insert to authenticated with check (creator_id=auth.uid() and public.is_member(couple_id));
create policy playlist_delete on public.playlists for delete to authenticated using (creator_id=auth.uid() and public.is_member(couple_id));
grant select,insert,delete on public.playlists to authenticated;
create policy track_read on public.playlist_tracks for select to authenticated using (exists(select 1 from public.playlists where id=playlist_id and public.is_member(couple_id)));
create policy track_insert on public.playlist_tracks for insert to authenticated with check (creator_id=auth.uid() and exists(select 1 from public.playlists where id=playlist_id and public.is_member(couple_id)));
create policy track_delete on public.playlist_tracks for delete to authenticated using (creator_id=auth.uid() and exists(select 1 from public.playlists where id=playlist_id and public.is_member(couple_id)));
grant select,insert,delete on public.playlist_tracks to authenticated;
create policy track_favorite_read on public.track_favorites for select to authenticated using (user_id=auth.uid());
create policy track_favorite_insert on public.track_favorites for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.playlist_tracks t join public.playlists p on p.id=t.playlist_id where t.id=track_id and public.is_member(p.couple_id)));
create policy track_favorite_delete on public.track_favorites for delete to authenticated using (user_id=auth.uid());
grant select,insert,delete on public.track_favorites to authenticated;
create policy question_read on public.game_questions for select to authenticated using (auth.uid() is not null);
grant select on public.game_questions to authenticated;
create policy game_read on public.game_sessions for select to authenticated using (public.is_member(couple_id));
grant select on public.game_sessions to authenticated;
create policy answer_read on public.game_answers for select to authenticated using (exists(select 1 from public.game_sessions where id=session_id and public.is_member(couple_id)) and (user_id=auth.uid() or public.game_revealed(session_id)));
grant select on public.game_answers to authenticated;
create policy notification_read on public.notifications for select to authenticated using (owner_id=auth.uid());
create policy notification_update on public.notifications for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
grant select on public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
-- Deliberately separate owner-only policies for all sensitive health and device tables.
do $$ declare t text; begin
  foreach t in array array['notification_preferences','notification_subscriptions','cycle_settings','period_records','cycle_reminders','cycle_sharing_preferences'] loop
    execute format('create policy owner_read on public.%I for select to authenticated using (owner_id=auth.uid())',t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (owner_id=auth.uid())',t);
    execute format('create policy owner_update on public.%I for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid())',t);
    execute format('create policy owner_delete on public.%I for delete to authenticated using (owner_id=auth.uid())',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;
-- Function privileges are explicit; SECURITY DEFINER alone does not mean PUBLIC executable.
revoke all on all functions in schema public from public,anon,authenticated;
revoke all on all functions in schema app_private from public,anon,authenticated;
grant execute on function public.current_couple(),public.is_member(uuid),public.are_partners(uuid),public.can_chat(uuid),public.can_read_asset(uuid),public.can_read_storage(text),public.can_write_storage(text),public.game_revealed(uuid) to authenticated;
grant execute on function public.create_couple(date),public.create_invitation(text),public.accept_invitation(text),public.revoke_invitation(uuid),public.list_invitations(),public.reserve_upload(text,text,text,integer,integer),public.delete_message(uuid),public.mark_conversation_read(uuid),public.send_letter(uuid,timestamptz),public.open_letter(uuid),public.cancel_letter(uuid),public.save_mood(text,text,boolean,timestamptz,date),public.get_partner_cycle_share(),public.delete_cycle_data(),public.start_game(text),public.answer_game(uuid,text),public.reveal_answer(uuid),public.save_game_memory(uuid) to authenticated;
grant all on all tables in schema public to service_role;
grant all on all tables in schema app_private to service_role;
grant usage on schema app_private to service_role;
commit;
