begin;
create function public.save_memory(memory_id uuid, fields jsonb, assets uuid[] default '{}') returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid; target uuid:=public.current_couple(); a uuid; i integer:=0;
begin
  perform app_private.check_rate('memory', 30, 3600);
  if target is null then raise exception 'membership_required'; end if;
  if cardinality(assets)>8 then raise exception 'too_many_files'; end if;
  if memory_id is null then
    insert into public.memories(couple_id,creator_id,title,description,memory_date,location,category,tags,music_url)
    values(target,auth.uid(),fields->>'title',coalesce(fields->>'description',''),(fields->>'memory_date')::date,nullif(fields->>'location',''),coalesce(fields->>'category','everyday'),coalesce(array(select jsonb_array_elements_text(fields->'tags')),'{}'),nullif(fields->>'music_url','')) returning id into result;
  else
    select id into result from public.memories where id=memory_id and creator_id=auth.uid() and couple_id=target for update;
    if result is null then raise exception 'not_found'; end if;
    update public.memories set title=fields->>'title',description=coalesce(fields->>'description',''),memory_date=(fields->>'memory_date')::date,location=nullif(fields->>'location',''),category=coalesce(fields->>'category','everyday'),tags=coalesce(array(select jsonb_array_elements_text(fields->'tags')),'{}'),music_url=nullif(fields->>'music_url','') where id=result;
  end if;
  foreach a in array assets loop
    perform app_private.validate_asset(a,'memory',target,auth.uid());
    insert into public.memory_media(memory_id,asset_id,position) values(result,a,i);
    i:=i+1;
  end loop;
  return result;
end $$;
revoke all on function public.save_memory(uuid,jsonb,uuid[]) from public,anon;
grant execute on function public.save_memory(uuid,jsonb,uuid[]) to authenticated;

create function app_private.queue_notification(target uuid, cat text, notice_kind text, link text, dedupe text) returns void language plpgsql security definer set search_path = '' as $$
declare allowed boolean; notice uuid;
begin
  select coalesce((to_jsonb(p)->>cat)::boolean,false) into allowed from public.notification_preferences p where owner_id=target;
  if not coalesce(allowed,false) then return; end if;
  insert into public.notifications(owner_id,category,kind,href,dedupe_key) values(target,cat,notice_kind,link,dedupe) on conflict (owner_id,dedupe_key) do nothing returning id into notice;
  if notice is not null then insert into app_private.push_outbox(notification_id) values(notice); end if;
end $$;
create function app_private.notify_shared_activity() returns trigger language plpgsql security definer set search_path = '' as $$
declare target uuid; couple uuid; actor uuid;
begin
  if tg_table_name='messages' then
    select couple_id into couple from public.conversations where id=new.conversation_id;
    actor:=new.sender_id;
  else couple:=new.couple_id; actor:=new.creator_id;
  end if;
  for target in select user_id from public.couple_members where couple_id=couple and user_id<>actor loop
    if tg_table_name='messages' then perform app_private.queue_notification(target,'chat','message','/chat','message:'||new.id);
    else perform app_private.queue_notification(target,'memories','memory','/memories','memory:'||new.id); end if;
  end loop;
  return new;
end $$;
create trigger notify_message after insert on public.messages for each row execute function app_private.notify_shared_activity();
create trigger notify_memory after insert on public.memories for each row execute function app_private.notify_shared_activity();
create function app_private.notify_letter() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.state='available' and old.state<>'available' then perform app_private.queue_notification(new.recipient_id,'letters','letter','/letters','letter:'||new.id); end if;
  return new;
end $$;
create trigger notify_available_letter after update on public.letters for each row execute function app_private.notify_letter();

-- Caller must be service_role; no HTTP endpoint can invoke this with an end-user credential.
create function public.process_due_reminders(batch_size integer default 100) returns integer language plpgsql security definer set search_path = '' as $$
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
    update public.events set next_reminder_at=case
      when item.recurrence='FREQ=WEEKLY' then ((item.next_reminder_at at time zone item.timezone)+interval '7 days') at time zone item.timezone
      when item.recurrence='FREQ=MONTHLY' then ((item.next_reminder_at at time zone item.timezone)+interval '1 month') at time zone item.timezone
      else null end where id=item.id;
    n:=n+1;
  end loop;
  for item in select id,owner_id from public.cycle_reminders where enabled and due_at<=now() order by due_at for update skip locked limit batch_size loop
    perform app_private.queue_notification(item.owner_id,'cycle','private_reminder','/cycle','reminder:'||item.id);
    update public.cycle_reminders set enabled=false where id=item.id; n:=n+1;
  end loop;
  -- Detached reservations are inaccessible to a partner, and are physically collected by the job.
  delete from public.upload_assets a where created_at<now()-interval '24 hours'
    and not exists(select 1 from public.memory_media where asset_id=a.id)
    and not exists(select 1 from public.messages where asset_id=a.id)
    and not exists(select 1 from public.letters where asset_id=a.id);
  delete from app_private.rate_windows where window_start<now()-interval '2 days';
  delete from public.notifications where created_at<now()-interval '90 days';
  delete from public.invitations where expires_at<now()-interval '30 days';
  return n;
end $$;
create function public.claim_push_batch(batch_size integer default 50) returns table(notification_id uuid,owner_id uuid) language plpgsql security definer set search_path = '' as $$
begin
  return query with claimed as (
    select o.notification_id from app_private.push_outbox o where (o.state='pending' or (o.state='sending' and o.locked_at<now()-interval '5 minutes')) and o.attempts<3 order by o.notification_id for update skip locked limit least(greatest(batch_size,1),100)
  ), updated as (
    update app_private.push_outbox o set state='sending',locked_at=now(),attempts=o.attempts+1 from claimed c where o.notification_id=c.notification_id returning o.notification_id
  ) select n.id,n.owner_id from updated u join public.notifications n on n.id=u.notification_id;
end $$;
create function public.finish_push(target uuid, result text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if result not in ('sent','skipped','pending','failed') then raise exception 'invalid_state'; end if;
  update app_private.push_outbox set state=case when result='pending' and attempts>=3 then 'failed' else result end where notification_id=target;
end $$;
create function public.cleanup_batch() returns table(storage_path text) language sql security definer set search_path = '' as $$
  select storage_path from app_private.storage_cleanup order by created_at limit 100
$$;
create function public.finish_cleanup(path text, success boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if success then delete from app_private.storage_cleanup where storage_path=path;
  else update app_private.storage_cleanup set attempts=attempts+1 where storage_path=path; end if;
end $$;
revoke all on all functions in schema app_private from public,anon,authenticated;
revoke all on function public.process_due_reminders(integer),public.claim_push_batch(integer),public.finish_push(uuid,text),public.cleanup_batch(),public.finish_cleanup(text,boolean) from public,anon,authenticated;
grant execute on function public.process_due_reminders(integer),public.claim_push_batch(integer),public.finish_push(uuid,text),public.cleanup_batch(),public.finish_cleanup(text,boolean) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('couple-media','couple-media',false,20971520,array['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/webm','audio/ogg','audio/mp4','audio/wav'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy private_media_read on storage.objects for select to authenticated using (bucket_id='couple-media' and public.can_read_storage(name));
create policy private_media_insert on storage.objects for insert to authenticated with check (bucket_id='couple-media' and public.can_write_storage(name));
-- No overwrite or client DELETE policy. Asset deletion queues server-side physical removal.
-- RLS is rechecked by Realtime for Postgres Changes; no public broadcast channel is used.
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.messages,public.message_reactions,public.conversation_reads,public.memories,public.notifications,public.game_sessions,public.game_answers;
  end if;
end $$;
commit;
