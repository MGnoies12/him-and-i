begin;
-- A publishable key must not be able to bypass content inspection with a direct Storage upload.
-- The Next.js media handler authenticates the owner, inspects/normalizes bytes, and only then
-- writes to this bucket using the server-only secret key. SELECT still uses caller RLS.
drop policy private_media_insert on storage.objects;
commit;
