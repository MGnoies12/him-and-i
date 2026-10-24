begin;
-- Lock shared state BEFORE profile foreign-key cascades acquire invitation/message locks.
-- Without this, simultaneous partner deletions can deadlock on accepted_by/inviter_id cascades.
create function app_private.lock_space_before_profile_delete() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform c.id from public.couples c join public.couple_members m on m.couple_id=c.id
    where m.user_id=old.id for update of c;
  return old;
end $$;
create trigger lock_space_before_profile_delete before delete on public.profiles
for each row execute function app_private.lock_space_before_profile_delete();
revoke all on function app_private.lock_space_before_profile_delete() from public,anon,authenticated;

-- Creation, acceptance and account deletion now all lock couple -> invitation.
-- The first token read is only a lookup; all authorization is rechecked after locks.
create or replace function public.accept_invitation(hashed_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare invite public.invitations; available_slot smallint;
begin
  perform app_private.check_rate('accept_invite',15,3600);
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into invite from public.invitations where token_hash=hashed_token;
  if invite.id is null or invite.revoked_at is not null or invite.accepted_at is not null or invite.expires_at<=now() then raise exception 'invalid_invitation'; end if;
  if public.current_couple() is not null then raise exception 'already_member'; end if;
  perform 1 from public.couples where id=invite.couple_id for update;
  if not found then raise exception 'invalid_invitation'; end if;
  select * into invite from public.invitations where token_hash=hashed_token for update;
  if invite.id is null or invite.revoked_at is not null or invite.accepted_at is not null or invite.expires_at<=now() then raise exception 'invalid_invitation'; end if;
  if not exists(select 1 from public.couple_members where couple_id=invite.couple_id and user_id=invite.inviter_id) then raise exception 'invalid_invitation'; end if;
  select s::smallint into available_slot from generate_series(1,2) s
    where not exists(select 1 from public.couple_members where couple_id=invite.couple_id and slot=s) order by s limit 1;
  if available_slot is null then raise exception 'couple_full'; end if;
  insert into public.couple_members(couple_id,user_id,slot) values(invite.couple_id,auth.uid(),available_slot);
  update public.invitations set accepted_at=now(),accepted_by=auth.uid() where id=invite.id;
  return invite.couple_id;
end $$;
commit;
