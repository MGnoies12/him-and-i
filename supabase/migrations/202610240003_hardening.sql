begin;
-- Bound free-form arrays as well as their item counts.
alter table public.memories add constraint bounded_memory_tags check (octet_length(tags::text)<=2000);
alter table public.period_records add constraint bounded_symptoms check (octet_length(symptoms::text)<=3000);
-- Validate the push endpoint at the database boundary too, not only in the Next.js handler.
alter table public.notification_subscriptions add constraint valid_subscription check (coalesce(
  (transport='web' and subscription->>'endpoint' ~ '^https://([a-z0-9-]+[.])*(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|wns[.]windows[.]com)/[^[:space:]]+$'
    and subscription->'keys'->>'p256dh' ~ '^[A-Za-z0-9_-]{80,100}$'
    and subscription->'keys'->>'auth' ~ '^[A-Za-z0-9_-]{20,30}$')
  or (transport in ('fcm','apns') and subscription->>'token' ~ '^[A-Za-z0-9:_-]{20,4096}$')
,false));
-- CHECK expressions with missing JSON fields can be NULL: explicitly require the fields as well.
alter table public.notification_subscriptions add constraint required_subscription_fields check (
  case when transport='web' then (subscription ? 'endpoint') and (subscription ? 'keys') and (subscription->'keys' ? 'p256dh') and (subscription->'keys' ? 'auth')
  else subscription ? 'token' end
);
create or replace function public.cancel_letter(letter_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.letters set state='cancelled' where id=letter_id and sender_id=auth.uid() and public.is_member(couple_id) and (state='draft' or (state='scheduled' and release_at>now()));
  if not found then raise exception 'invalid_letter_state'; end if;
end $$;
create or replace function public.answer_game(target uuid, value text) returns void language plpgsql security definer set search_path = '' as $$
declare item public.game_sessions; payload jsonb;
begin
  perform app_private.check_rate('answer',40,3600);
  select * into item from public.game_sessions where id=target and public.is_member(couple_id) for update;
  if item.id is null or item.closed then raise exception 'invalid_game'; end if;
  if item.game_type='choice' and value not in ('0','1') then raise exception 'invalid_answer'; end if;
  if item.game_type='know' then
    begin payload:=value::jsonb; exception when others then raise exception 'invalid_answer'; end;
    if jsonb_typeof(payload)<>'object' or not(payload ? 'own') or not(payload ? 'guess') or jsonb_typeof(payload->'own')<>'string' or jsonb_typeof(payload->'guess')<>'string' or char_length(trim(payload->>'own')) not between 1 and 800 or char_length(trim(payload->>'guess')) not between 1 and 800 then raise exception 'invalid_answer'; end if;
  end if;
  insert into public.game_answers(session_id,user_id,answer,reveal_consent) values(target,auth.uid(),value,item.game_type<>'daily');
end $$;

-- RFC 5545 subset: one weekly/monthly occurrence at the original event's wall-clock time.
-- Invalid month-days are skipped (31 January -> 31 March), never clamped to a new day.
create function public.next_event_occurrence(anchor timestamptz, zone text, rule text, after_time timestamptz) returns timestamptz language plpgsql stable set search_path = '' as $$
declare base timestamp:=anchor at time zone zone; candidate timestamp; result timestamptz; i integer;
begin
  if rule is null then return null; end if;
  if rule not in ('FREQ=WEEKLY','FREQ=MONTHLY') then raise exception 'invalid_recurrence'; end if;
  for i in 1..2400 loop
    candidate:=base+case when rule='FREQ=WEEKLY' then make_interval(weeks=>i) else make_interval(months=>i) end;
    if rule='FREQ=MONTHLY' and extract(day from candidate)<>extract(day from base) then continue; end if;
    result:=candidate at time zone zone;
    -- Skip nonexistent DST-local times; initial ambiguous times are rejected by the application.
    if (result at time zone zone)<>candidate then continue; end if;
    if result>after_time then return result; end if;
  end loop;
  return null;
end $$;
revoke all on function public.next_event_occurrence(timestamptz,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.next_event_occurrence(timestamptz,text,text,timestamptz) to service_role;
create or replace function public.process_due_reminders(batch_size integer default 100) returns integer language plpgsql security definer set search_path = '' as $$
declare n integer:=0; item record; recipient uuid;
begin
  if batch_size not between 1 and 500 then raise exception 'invalid_batch'; end if;
  for item in select id from public.letters where state='scheduled' and release_at<=now() order by release_at for update skip locked limit batch_size loop
    update public.letters set state='available' where id=item.id; n:=n+1;
  end loop;
  for item in select * from public.events where reminder_enabled and status='planned' and next_reminder_at<=now() order by next_reminder_at for update skip locked limit batch_size loop
    for recipient in select user_id from public.couple_members where couple_id=item.couple_id loop
      perform app_private.queue_notification(recipient,'events','event','/calendar','event:'||item.id||':'||item.next_reminder_at);
    end loop;
    update public.events set next_reminder_at=public.next_event_occurrence(item.starts_at,item.timezone,item.recurrence,now()+interval '1 hour')-interval '1 hour' where id=item.id;
    n:=n+1;
  end loop;
  for item in select id,owner_id from public.cycle_reminders where enabled and due_at<=now() order by due_at for update skip locked limit batch_size loop
    perform app_private.queue_notification(item.owner_id,'cycle','private_reminder','/cycle','reminder:'||item.id);
    update public.cycle_reminders set enabled=false where id=item.id; n:=n+1;
  end loop;
  delete from public.upload_assets a where created_at<now()-interval '24 hours'
    and not exists(select 1 from public.memory_media where asset_id=a.id)
    and not exists(select 1 from public.messages where asset_id=a.id)
    and not exists(select 1 from public.letters where asset_id=a.id);
  delete from app_private.rate_windows where window_start<now()-interval '2 days';
  delete from public.notifications where created_at<now()-interval '90 days';
  delete from public.invitations where expires_at<now()-interval '30 days';
  return n;
end $$;
-- Service role can run jobs, but authenticated users cannot call internal helpers.
revoke all on all functions in schema app_private from public,anon,authenticated;
commit;
