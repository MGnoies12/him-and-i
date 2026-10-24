begin;
-- Relationship dates/conversation metadata must not outlive both deleted accounts.
-- Lock the parent so simultaneous partner deletions serialize the empty-space check.
-- A cascade originating from an already-deleted couple simply finds no parent and returns.
create function app_private.erase_empty_space() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.couples where id=old.couple_id for update;
  if not found then return old; end if;
  delete from public.couples where id=old.couple_id
    and not exists(select 1 from public.couple_members where couple_id=old.couple_id);
  return old;
end $$;
create trigger erase_empty_space after delete on public.couple_members
for each row execute function app_private.erase_empty_space();
revoke all on function app_private.erase_empty_space() from public,anon,authenticated;
commit;
