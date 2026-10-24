import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
export const scaffold = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;
`;
export async function createTestDatabase() {
  const db = new PGlite();
  await db.exec(scaffold);
  for (const name of (await readdir('supabase/migrations')).sort())
    await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8'));
  await db.exec(await readFile('supabase/seed.sql', 'utf8'));
  return db;
}
