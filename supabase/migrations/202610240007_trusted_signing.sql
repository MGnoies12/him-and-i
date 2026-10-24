begin;
-- Supabase's public Storage signing endpoint accepts a caller-chosen expiry. Granting
-- authenticated SELECT would let a member mint a year-long URL despite the API's 60s rule.
-- Keep all bucket I/O server-only; the media handler first checks upload_assets with caller
-- RLS, then signs exactly that authorized object for 60 seconds using the server secret.
drop policy private_media_read on storage.objects;
revoke all on function public.can_read_storage(text),public.can_write_storage(text) from public,anon,authenticated;
update storage.buckets set file_size_limit=4194304 where id='couple-media';
commit;
