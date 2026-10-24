begin;

-- Only these RPCs can change an existing reaction/RSVP. Each statement is atomic and
-- pins identity to auth.uid(), rather than trusting a client-supplied user ID.
create function public.set_message_reaction(target uuid, value text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.messages where id=target and deleted_at is null and public.can_chat(conversation_id)) then raise exception 'not_found'; end if;
  perform app_private.check_rate('reaction',120,60);
  if value is null then
    delete from public.message_reactions where message_id=target and user_id=auth.uid();
  else
    insert into public.message_reactions(message_id,user_id,emoji) values(target,auth.uid(),value)
      on conflict(message_id,user_id) do update set emoji=excluded.emoji;
  end if;
end $$;
create function public.set_event_response(target uuid, value text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.events where id=target and public.is_member(couple_id)) then raise exception 'not_found'; end if;
  perform app_private.check_rate('rsvp',60,60);
  insert into public.event_responses(event_id,user_id,response) values(target,auth.uid(),value)
    on conflict(event_id,user_id) do update set response=excluded.response;
end $$;
revoke all on function public.set_message_reaction(uuid,text),public.set_event_response(uuid,text) from public,anon,authenticated;
grant execute on function public.set_message_reaction(uuid,text),public.set_event_response(uuid,text) to authenticated;

-- Enforce date semantics even for a direct PostgREST write, using the owner's chosen zone.
create function app_private.validate_period_dates() returns trigger language plpgsql set search_path = '' as $$
declare zone text; today date;
begin
  select timezone into zone from public.profiles where id=new.owner_id;
  today:=(now() at time zone coalesce(zone,'UTC'))::date;
  if new.start_date>today or new.end_date>today then raise exception 'invalid_date'; end if;
  return new;
end $$;
create trigger validate_period_dates before insert or update of start_date,end_date on public.period_records for each row execute function app_private.validate_period_dates();
create function app_private.validate_all_day_event() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.all_day and (new.ends_at is null or (new.starts_at at time zone new.timezone)::time<>time '00:00' or (new.ends_at at time zone new.timezone)::time<>time '00:00') then raise exception 'invalid_date'; end if;
  return new;
end $$;
create trigger validate_all_day_event before insert or update of starts_at,ends_at,timezone,all_day on public.events for each row execute function app_private.validate_all_day_event();
create function app_private.validate_relationship_date() returns trigger language plpgsql set search_path = '' as $$
declare zone text;
begin
  select timezone into zone from public.profiles where id=auth.uid();
  if new.relationship_start>(now() at time zone coalesce(zone,'UTC'))::date then raise exception 'invalid_date'; end if;
  return new;
end $$;
create trigger validate_relationship_date before insert or update of relationship_start on public.couples for each row execute function app_private.validate_relationship_date();
create or replace function public.create_couple(start_date date default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform app_private.check_rate('create_couple',3,3600);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if public.current_couple() is not null then raise exception 'already_member'; end if;
  insert into public.couples(created_by,relationship_start) values(auth.uid(),start_date) returning id into result;
  insert into public.couple_members(couple_id,user_id,slot) values(result,auth.uid(),1);
  insert into public.conversations(couple_id) values(result);
  return result;
end $$;

-- No credentials, whitespace, executable schemes, or control characters in saved links.
alter table public.playlist_tracks add constraint safe_track_url check(url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$');
alter table public.memories add constraint safe_memory_music_url check(music_url is null or music_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$');

-- Failed removals do not permanently starve later deletion requests.
create or replace function public.cleanup_batch() returns table(storage_path text) language sql security definer set search_path = '' as $$
  select storage_path from app_private.storage_cleanup order by attempts,created_at limit 100
$$;
create function public.finish_cleanup_paths(paths text[],success boolean default true) returns void language plpgsql security definer set search_path = '' as $$
begin
  if cardinality(paths)>100 then raise exception 'invalid_batch'; end if;
  if success then delete from app_private.storage_cleanup where storage_path=any(paths);
  else update app_private.storage_cleanup set attempts=attempts+1 where storage_path=any(paths); end if;
end $$;
revoke all on function public.finish_cleanup_paths(text[],boolean) from public,anon,authenticated;
grant execute on function public.finish_cleanup_paths(text[],boolean) to service_role;
revoke all on all functions in schema app_private from public,anon,authenticated;
commit;
