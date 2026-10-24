begin;
-- Personal presentation is owner-private. It is never an authorization role or shared profile field.
create table public.profile_preferences (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  gender text not null default 'unspecified' check(gender in ('female','male','other','unspecified')),
  layout text not null default 'auto' check(layout in ('auto','rose','dusk')),
  cycle_tracking boolean not null default false,
  onboarding_completed_at timestamptz
);
alter table public.profile_preferences enable row level security;
create policy personal_preferences_read on public.profile_preferences for select to authenticated using(owner_id=auth.uid());
create policy personal_preferences_update on public.profile_preferences for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
revoke all on public.profile_preferences from public,anon,authenticated;
grant select on public.profile_preferences to authenticated;
grant update(gender,layout,cycle_tracking) on public.profile_preferences to authenticated;
grant all on public.profile_preferences to service_role;
create trigger protect_personal_preferences before update on public.profile_preferences for each row execute function app_private.guard_identity();

alter table public.cycle_settings add column manual_length_confirmed boolean not null default false;
alter table public.cycle_settings add column cycles_irregular boolean not null default false;

insert into public.profile_preferences(owner_id,cycle_tracking)
select p.id,exists(select 1 from public.period_records r where r.owner_id=p.id) from public.profiles p;

create or replace function app_private.bootstrap_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),60));
  insert into public.notification_preferences(owner_id) values(new.id);
  insert into public.cycle_settings(owner_id) values(new.id);
  insert into public.cycle_sharing_preferences(owner_id) values(new.id);
  -- Never read a period date or other health history from Auth metadata.
  insert into public.profile_preferences(owner_id,gender) values(new.id,
    case when new.raw_user_meta_data->>'gender' in ('female','male','other','unspecified')
      then new.raw_user_meta_data->>'gender' else 'unspecified' end);
  return new;
end $$;

create function app_private.disable_cycle_preferences() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not new.cycle_tracking then
    update public.cycle_sharing_preferences set share_status=false,share_estimate=false,status_text='',approximate_date=null,updated_at=now() where owner_id=new.owner_id;
    update public.cycle_settings set prediction_enabled=false where owner_id=new.owner_id;
    update public.notification_preferences set cycle=false where owner_id=new.owner_id;
    update public.cycle_reminders set enabled=false where owner_id=new.owner_id;
    delete from public.notifications where owner_id=new.owner_id and category='cycle';
  end if;
  return new;
end $$;
create trigger disable_cycle_preferences after update of cycle_tracking on public.profile_preferences for each row execute function app_private.disable_cycle_preferences();

create function public.complete_profile(
  person_name text, person_gender text, chosen_layout text, person_locale text, person_timezone text,
  track_cycle boolean, period_start date default null, reported_length integer default null,
  irregular boolean default false
) returns void language plpgsql security definer set search_path='' as $$
declare person uuid := auth.uid();
begin
  if person is null then raise exception 'unauthenticated'; end if;
  perform app_private.check_rate('profile_setup',30,3600);
  if person_name is null or char_length(btrim(person_name)) not between 1 and 60
    or person_gender is null or person_gender not in ('female','male','other','unspecified')
    or chosen_layout is null or chosen_layout not in ('auto','rose','dusk')
    or person_locale is null or person_locale not in ('fa','en')
    or track_cycle is null or irregular is null then raise exception 'validation_failed'; end if;
  if (period_start is not null and not track_cycle)
    or (reported_length is not null and (period_start is null or reported_length not between 15 and 90)) then raise exception 'validation_failed'; end if;
  update public.profiles set display_name=btrim(person_name),locale=person_locale,timezone=person_timezone where id=person;
  if not found then raise exception 'unauthenticated'; end if;
  update public.profile_preferences set gender=person_gender,layout=chosen_layout,cycle_tracking=track_cycle,onboarding_completed_at=coalesce(onboarding_completed_at,now()) where owner_id=person;
  if period_start is not null then
    -- The existing period trigger rejects future dates in this owner's chosen timezone.
    insert into public.period_records(owner_id,start_date) values(person,period_start) on conflict(owner_id,start_date) do nothing;
    update public.cycle_settings set prediction_enabled=not irregular and reported_length is not null,
      cycle_length=coalesce(reported_length,cycle_length),manual_length_confirmed=reported_length is not null,cycles_irregular=irregular where owner_id=person;
  end if;
end $$;

-- Short typing codes reuse the same row locks, capacity and single-use acceptance as 256-bit links.
-- Only a domain-separated hash is stored; raw codes are generated by the trusted API.
create function public.create_pairing_code(hashed_code text) returns table(id uuid,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare invitation uuid;
begin
  select i.id into invitation from public.create_invitation(hashed_code) i;
  return query update public.invitations i set expires_at=now()+interval '15 minutes' where i.id=invitation returning i.id,i.expires_at;
end $$;

create or replace function public.delete_cycle_data() returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'unauthenticated'; end if;
  delete from public.period_records where owner_id=auth.uid();
  delete from public.cycle_reminders where owner_id=auth.uid();
  delete from public.notifications where owner_id=auth.uid() and category='cycle';
  update public.cycle_settings set prediction_enabled=false,cycle_length=28,period_length=5,manual_length_confirmed=false,cycles_irregular=false where owner_id=auth.uid();
  update public.cycle_sharing_preferences set share_status=false,share_estimate=false,status_text='',approximate_date=null,updated_at=now() where owner_id=auth.uid();
  update public.notification_preferences set cycle=false where owner_id=auth.uid();
  update public.profile_preferences set cycle_tracking=false where owner_id=auth.uid();
end $$;

revoke all on function app_private.disable_cycle_preferences() from public,anon,authenticated;
revoke all on function public.complete_profile(text,text,text,text,text,boolean,date,integer,boolean),public.create_pairing_code(text) from public,anon;
grant execute on function public.complete_profile(text,text,text,text,text,boolean,date,integer,boolean),public.create_pairing_code(text) to authenticated;
commit;
