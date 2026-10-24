begin;
-- FK SET NULL can precede the message's account-deletion cascade. Preserve the empty-message
-- invariant during that intermediate step, and make a removed voice-only attachment a tombstone.
create function app_private.tombstone_detached_message() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.asset_id is not null and new.asset_id is null and new.body='' then new.deleted_at:=coalesce(new.deleted_at,now()); end if;
  return new;
end $$;
create trigger tombstone_detached_media before update of asset_id on public.messages for each row execute function app_private.tombstone_detached_message();
revoke all on function app_private.tombstone_detached_message() from public,anon,authenticated;
commit;
