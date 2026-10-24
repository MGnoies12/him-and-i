// Real multi-connection PostgreSQL tests. Never point this at a personal/production database.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import { scaffold } from './test-database.mjs';
const connectionString = process.env.DATABASE_TEST_URL;
if (!connectionString)
  throw new Error(
    'DATABASE_TEST_URL is required and must point to a disposable local PostgreSQL instance.',
  );
const url = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('Refusing to run destructive integration setup on a remote database.');
const database = `himandi_test_${randomUUID().replaceAll('-', '')}`;
const control = new pg.Client({ connectionString });
await control.connect();
await control.query(`create database ${database}`);
const target = new URL(url);
target.pathname = '/' + database;
const pool = new pg.Pool({ connectionString: target.toString(), max: 12 });
const connections = new Set();
pool.on('connect', (client) => connections.add(client));
pool.on('error', (error) => {
  console.error('PostgreSQL pool failed:', error.code || 'unknown');
  process.exitCode = 1;
});
async function as(user, sql, params = []) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    const result = await client.query(sql, params);
    await client.query('commit');
    return result.rows;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
async function user() {
  const id = randomUUID();
  await pool.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [
    id,
    { display_name: 'Synthetic race fixture' },
  ]);
  return id;
}
async function space() {
  const owner = await user();
  const couple = (await as(owner, 'select public.create_couple(null) as id'))[0].id;
  return { owner, couple };
}
async function invite(owner) {
  const hash = createHash('sha256').update(randomBytes(32)).digest('hex');
  await as(owner, 'select public.create_invitation($1)', [hash]);
  return hash;
}
async function attempt(who, hash) {
  return as(who, 'select public.accept_invitation($1) as id', [hash]);
}
try {
  const roleSetup = scaffold.replace(
    'create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;',
    () =>
      `do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;`,
  );
  await pool.query(roleSetup);
  for (const name of (await readdir('supabase/migrations')).sort())
    await pool.query(await readFile(`supabase/migrations/${name}`, 'utf8'));
  await pool.query(await readFile('supabase/seed.sql', 'utf8'));
  console.log('PASS: all versioned migrations and seed apply on real PostgreSQL.');
  const one = await space();
  const token = await invite(one.owner);
  const candidates = await Promise.all([user(), user()]);
  const firstRace = await Promise.allSettled(candidates.map((id) => attempt(id, token)));
  assert.equal(firstRace.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    firstRace.filter((r) => r.status === 'rejected' && r.reason.message === 'invalid_invitation')
      .length,
    1,
  );
  assert.equal(
    Number(
      (
        await pool.query('select count(*) from public.couple_members where couple_id=$1', [
          one.couple,
        ])
      ).rows[0].count,
    ),
    2,
  );
  console.log(
    'PASS: simultaneous acceptance of the same single-use invitation has exactly one winner.',
  );
  const two = await space(),
    three = await space(),
    joiner = await user();
  const hashes = await Promise.all([invite(two.owner), invite(three.owner)]);
  const secondRace = await Promise.allSettled(hashes.map((hash) => attempt(joiner, hash)));
  assert.equal(secondRace.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    secondRace.filter((r) => r.status === 'rejected' && r.reason.message === 'already_member')
      .length,
    1,
  );
  assert.equal(
    Number(
      (await pool.query('select count(*) from public.couple_members where user_id=$1', [joiner]))
        .rows[0].count,
    ),
    1,
  );
  console.log('PASS: simultaneous invitations cannot put a person into two spaces.');
  const four = await space();
  const extraHashes = [randomBytes(32).toString('hex'), randomBytes(32).toString('hex')];
  // Privileged fixture creates two outstanding invitations to stress the couple-row lock itself.
  for (const hash of extraHashes)
    await pool.query(
      'insert into public.invitations(couple_id,inviter_id,token_hash) values($1,$2,$3)',
      [four.couple, four.owner, hash],
    );
  const extraUsers = await Promise.all([user(), user()]);
  const capacityRace = await Promise.allSettled(
    extraUsers.map((id, index) => attempt(id, extraHashes[index])),
  );
  assert.equal(capacityRace.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    capacityRace.filter((r) => r.status === 'rejected' && r.reason.message === 'couple_full')
      .length,
    1,
  );
  assert.equal(
    Number(
      (
        await pool.query('select count(*) from public.couple_members where couple_id=$1', [
          four.couple,
        ])
      ).rows[0].count,
    ),
    2,
  );
  assert.equal(
    Number(
      (
        await pool.query(
          'select count(*) from public.invitations where couple_id=$1 and accepted_at is not null',
          [four.couple],
        )
      ).rows[0].count,
    ),
    1,
  );
  console.log(
    'PASS: different tokens racing for one slot cannot exceed capacity or consume the losing invitation.',
  );
  const conversation = (await as(one.owner, 'select id from public.conversations'))[0].id;
  const sends = await Promise.allSettled(
    Array.from({ length: 41 }, () =>
      as(
        one.owner,
        "insert into public.messages(conversation_id,sender_id,body) values($1,$2,'Synthetic concurrency fixture') returning id",
        [conversation, one.owner],
      ),
    ),
  );
  assert.equal(sends.filter((r) => r.status === 'fulfilled').length, 40);
  assert.equal(
    sends.filter((r) => r.status === 'rejected' && r.reason.message === 'rate_limited').length,
    1,
  );
  console.log('PASS: database message rate limits stay atomic under concurrent sends.');
  async function claim() {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role service_role');
      const rows = (await client.query('select * from public.claim_push_batch(100)')).rows;
      await client.query('commit');
      return rows;
    } finally {
      client.release();
    }
  }
  const claims = (await Promise.all([claim(), claim()])).flat().map((r) => r.notification_id);
  assert.equal(claims.length, 40);
  assert.equal(new Set(claims).size, 40);
  console.log('PASS: concurrent push workers do not claim the same outbox item.');
  const lastSpace = await space();
  const lastPartner = await user();
  const lastToken = await invite(lastSpace.owner);
  await attempt(lastPartner, lastToken);
  await Promise.all(
    [lastSpace.owner, lastPartner].map((id) =>
      pool.query('delete from auth.users where id=$1', [id]),
    ),
  );
  assert.equal(
    (await pool.query('select id from public.couples where id=$1', [lastSpace.couple])).rows.length,
    0,
  );
  assert.equal(
    (await pool.query('select id from public.conversations where couple_id=$1', [lastSpace.couple]))
      .rows.length,
    0,
  );
  console.log(
    'PASS: simultaneous partner account deletion erases the empty space and its relationship metadata.',
  );
  console.log('All real PostgreSQL concurrency checks passed.');
} finally {
  // Pool.end removes idle clients before their sockets have necessarily finished closing.
  // Await each actual connection end before DROP DATABASE, avoiding a forced-termination race.
  await Promise.all([...connections].map((client) => client.end()));
  await pool.end();
  await control.query(`drop database ${database}`);
  await control.end();
}
