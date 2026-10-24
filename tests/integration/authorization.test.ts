import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDatabase } from '../../scripts/test-database.mjs';
const users = {
  a: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  b: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  c: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  d: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  e: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  f: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
  g: '12345678-1234-4234-8234-123456789abc',
};
let db: PGlite;
let coupleA: string;
let coupleC: string;
let conversationA: string;
let conversationC: string;
async function as<T = Record<string, unknown>>(user: string, sql: string, params: unknown[] = []) {
  await db.exec('savepoint operation');
  try {
    await db.exec('set local role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
    const result = await db.query<T>(sql, params);
    await db.exec('reset role; release savepoint operation');
    return result.rows;
  } catch (error) {
    await db.exec('rollback to savepoint operation; reset role; release savepoint operation');
    throw error;
  }
}
async function service<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  await db.exec('savepoint service_op');
  try {
    await db.exec('set local role service_role');
    const result = await db.query<T>(sql, params);
    await db.exec('reset role; release savepoint service_op');
    return result.rows;
  } catch (error) {
    await db.exec('rollback to savepoint service_op; reset role; release savepoint service_op');
    throw error;
  }
}
const memoryFields = {
  title: 'Synthetic test memory',
  description: 'Fictional isolated fixture',
  memory_date: '2026-06-10',
  category: 'everyday',
  tags: ['test'],
};
async function memory(user = users.a, assets: string[] = []) {
  return (
    await as<{ id: string }>(user, 'select public.save_memory(null,$1::jsonb,$2::uuid[]) as id', [
      JSON.stringify(memoryFields),
      assets,
    ])
  )[0].id;
}
async function asset(user = users.a, kind = 'memory') {
  return (
    await as<{ id: string; storage_path: string }>(
      user,
      "select * from public.reserve_upload($1,'jpg','image/jpeg',1024,null)",
      [kind],
    )
  )[0];
}
async function message(
  user = users.a,
  conversation = conversationA,
  attachment: string | null = null,
) {
  return (
    await as<{ id: string }>(
      user,
      "insert into public.messages(conversation_id,sender_id,body,asset_id) values($1,$2,'Synthetic hello',$3) returning id",
      [conversation, user, attachment],
    )
  )[0].id;
}
async function letter() {
  return (
    await as<{ id: string }>(
      users.a,
      "insert into public.letters(couple_id,sender_id,title,body) values($1,$2,'Test envelope','Synthetic private body') returning id",
      [coupleA, users.a],
    )
  )[0].id;
}
async function soloInvitation(hash = '3'.repeat(64)) {
  const couple = (await as<{ id: string }>(users.e, 'select public.create_couple(null) as id'))[0]
    .id;
  const invitation = (
    await as<{ id: string }>(users.e, 'select * from public.create_invitation($1)', [hash])
  )[0].id;
  return { couple, invitation, hash };
}
beforeAll(async () => {
  db = await createTestDatabase();
  for (const [name, id] of Object.entries(users))
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [
      id,
      JSON.stringify({ display_name: `Test ${name}` }),
    ]);
  await db.exec('begin');
  coupleA = (await as<{ id: string }>(users.a, 'select public.create_couple(null) as id'))[0].id;
  await as(users.a, 'select public.create_invitation($1)', ['1'.repeat(64)]);
  await as(users.b, 'select public.accept_invitation($1)', ['1'.repeat(64)]);
  coupleC = (await as<{ id: string }>(users.c, 'select public.create_couple(null) as id'))[0].id;
  await as(users.c, 'select public.create_invitation($1)', ['2'.repeat(64)]);
  await as(users.d, 'select public.accept_invitation($1)', ['2'.repeat(64)]);
  conversationA = (await as<{ id: string }>(users.a, 'select id from public.conversations'))[0].id;
  conversationC = (await as<{ id: string }>(users.c, 'select id from public.conversations'))[0].id;
  await db.exec('commit');
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec('begin');
});
afterEach(async () => {
  await db.exec('rollback');
});
describe('schema and authentication boundary', () => {
  it('enables RLS on every application table and creates only public, non-personal game seed data', async () => {
    const rows = (
      await db.query<{ relname: string; relrowsecurity: boolean }>(
        "select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
      )
    ).rows;
    expect(rows.length).toBeGreaterThanOrEqual(30);
    expect(rows.every((t) => t.relrowsecurity)).toBe(true);
    expect((await as(users.a, 'select * from public.game_questions')).length).toBe(15);
  });
  it('denies anonymous table access and privileged job execution', async () => {
    await db.exec('savepoint anon_check;set local role anon');
    await expect(db.query('select * from public.memories')).rejects.toThrow(/permission denied/);
    await db.exec('rollback to savepoint anon_check;reset role');
    await expect(as(users.a, 'select public.process_due_reminders(10)')).rejects.toThrow(
      /permission denied/,
    );
  });
  it('exposes only self and partner profiles, never cross-couple membership', async () => {
    expect(
      (await as<{ id: string }>(users.a, 'select id from public.profiles')).map((r) => r.id).sort(),
    ).toEqual([users.a, users.b].sort());
    expect(await as(users.a, 'select * from public.couples where id=$1', [coupleC])).toEqual([]);
    expect(
      await as(users.a, 'select * from public.couple_members where couple_id=$1', [coupleC]),
    ).toEqual([]);
  });
  it('does not allow arbitrary membership insertion or owner identity updates', async () => {
    await expect(
      as(users.e, 'insert into public.couple_members(couple_id,user_id,slot) values($1,$2,2)', [
        coupleA,
        users.e,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(users.a, 'update public.profiles set id=$1 where id=$2', [users.e, users.a]),
    ).rejects.toThrow(/permission denied/);
  });
});
describe('atomic, single-use invitations', () => {
  it('accepts a valid token hash into the only available slot', async () => {
    const item = await soloInvitation();
    await as(users.f, 'select public.accept_invitation($1)', [item.hash]);
    expect(
      (
        await as<{ user_id: string; slot: number }>(
          users.e,
          'select user_id,slot from public.couple_members',
        )
      )
        .map((r) => r.slot)
        .sort(),
    ).toEqual([1, 2]);
  });
  it('rejects invalid and reused tokens without creating membership', async () => {
    const item = await soloInvitation();
    await expect(
      as(users.f, 'select public.accept_invitation($1)', ['0'.repeat(64)]),
    ).rejects.toThrow('invalid_invitation');
    await as(users.f, 'select public.accept_invitation($1)', [item.hash]);
    await expect(as(users.g, 'select public.accept_invitation($1)', [item.hash])).rejects.toThrow(
      'invalid_invitation',
    );
    expect(await as(users.g, 'select * from public.couple_members')).toEqual([]);
  });
  it('rejects expired and revoked invitations', async () => {
    const item = await soloInvitation();
    await db.query(
      "update public.invitations set created_at=now()-interval '4 days',expires_at=now()-interval '1 day' where id=$1",
      [item.invitation],
    );
    await expect(as(users.f, 'select public.accept_invitation($1)', [item.hash])).rejects.toThrow(
      'invalid_invitation',
    );
    const hash = '4'.repeat(64);
    const fresh = (
      await as<{ id: string }>(users.e, 'select * from public.create_invitation($1)', [hash])
    )[0];
    await as(users.e, 'select public.revoke_invitation($1)', [fresh.id]);
    await expect(as(users.f, 'select public.accept_invitation($1)', [hash])).rejects.toThrow(
      'invalid_invitation',
    );
  });
  it('does not expose invitation hashes and prevents duplicate couple membership', async () => {
    const item = await soloInvitation();
    await expect(as(users.e, 'select token_hash from public.invitations')).rejects.toThrow(
      /permission denied/,
    );
    const summary = await as(users.e, 'select * from public.list_invitations()');
    expect(JSON.stringify(summary)).not.toContain('token_hash');
    await expect(as(users.a, 'select public.accept_invitation($1)', [item.hash])).rejects.toThrow(
      'already_member',
    );
    await expect(as(users.a, 'select public.create_couple(null)')).rejects.toThrow(
      'already_member',
    );
  });
  it('enforces two slots even if application code is bypassed', async () => {
    await expect(
      as(users.a, 'select public.create_invitation($1)', ['9'.repeat(64)]),
    ).rejects.toThrow('couple_full');
    await db.exec('savepoint constraint_check');
    await expect(
      db.query('insert into public.couple_members(couple_id,user_id,slot) values($1,$2,3)', [
        coupleA,
        users.e,
      ]),
    ).rejects.toThrow(/check constraint/);
    await db.exec('rollback to savepoint constraint_check');
  });
});
describe('memories and independently authorized private attachments', () => {
  it('keeps unlinked upload reservations and storage objects private even from the partner', async () => {
    const a = await asset();
    await db.query("insert into storage.objects(bucket_id,name) values('couple-media',$1)", [
      a.storage_path,
    ]);
    expect(await as(users.b, 'select * from public.upload_assets where id=$1', [a.id])).toEqual([]);
    expect(
      await as(users.b, 'select * from storage.objects where name=$1', [a.storage_path]),
    ).toEqual([]);
    await expect(
      as(users.a, "insert into storage.objects(bucket_id,name) values('couple-media',$1)", [
        a.storage_path,
      ]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(users.b, "insert into storage.objects(bucket_id,name) values('couple-media',$1)", [
        a.storage_path,
      ]),
    ).rejects.toThrow(/row-level security/);
  });
  it('atomically creates a memory with media, shares it with only the partner, and queues cleanup on delete', async () => {
    const a = await asset();
    const id = await memory(users.a, [a.id]);
    await db.query("insert into storage.objects(bucket_id,name) values('couple-media',$1)", [
      a.storage_path,
    ]);
    expect(await as(users.b, 'select id from public.memories where id=$1', [id])).toHaveLength(1);
    expect(
      await as(users.b, 'select * from public.upload_assets where id=$1', [a.id]),
    ).toHaveLength(1);
    expect(
      await as(users.b, 'select * from storage.objects where name=$1', [a.storage_path]),
    ).toEqual([]);
    expect(await as(users.c, 'select * from public.memories where id=$1', [id])).toEqual([]);
    expect(
      await as(users.c, 'select * from storage.objects where name=$1', [a.storage_path]),
    ).toEqual([]);
    expect(await as(users.b, 'delete from public.memories where id=$1 returning id', [id])).toEqual(
      [],
    );
    await as(users.a, 'delete from public.memories where id=$1', [id]);
    expect(
      await as(users.b, 'select * from storage.objects where name=$1', [a.storage_path]),
    ).toEqual([]);
    expect(
      (
        await db.query('select * from app_private.storage_cleanup where storage_path=$1', [
          a.storage_path,
        ])
      ).rows,
    ).toHaveLength(1);
    expect((await db.query('select * from public.upload_assets where id=$1', [a.id])).rows).toEqual(
      [],
    );
  });
  it('rolls back the entire memory when an attachment belongs to another couple', async () => {
    const foreign = await asset(users.c);
    await expect(memory(users.a, [foreign.id])).rejects.toThrow('invalid_attachment');
    expect(await as(users.a, 'select * from public.memories')).toEqual([]);
  });
  it('prevents cross-couple file linkage, storage path forging and owner spoofing', async () => {
    await expect(
      as(
        users.a,
        "insert into storage.objects(bucket_id,name) values('couple-media','arbitrary/path.jpg')",
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(
        users.a,
        "insert into public.memories(couple_id,creator_id,title,memory_date) values($1,$2,'Forged','2026-01-01')",
        [coupleA, users.b],
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(users.a, "select public.reserve_upload('memory','svg','image/svg+xml',100,null)"),
    ).rejects.toThrow('unsupported_media');
  });
});
describe('persisted chat, receipts and rate limits', () => {
  it('persists messages for two authorized members and denies sender spoofing/cross-couple reads', async () => {
    const id = await message();
    expect(await as(users.b, 'select id from public.messages where id=$1', [id])).toHaveLength(1);
    expect(await as(users.c, 'select * from public.messages where id=$1', [id])).toEqual([]);
    await expect(
      as(
        users.a,
        "insert into public.messages(conversation_id,sender_id,body) values($1,$2,'spoof')",
        [conversationA, users.b],
      ),
    ).rejects.toThrow(/row-level security/);
  });
  it('checks reply and attachment authorization independently of conversation access', async () => {
    const foreign = await message(users.c, conversationC);
    await expect(
      as(
        users.a,
        "insert into public.messages(conversation_id,sender_id,body,reply_to) values($1,$2,'reply',$3)",
        [conversationA, users.a, foreign],
      ),
    ).rejects.toThrow('invalid_reply');
    const a = await asset(users.c, 'chat');
    await expect(message(users.a, conversationA, a.id)).rejects.toThrow('invalid_attachment');
  });
  it('shares a linked chat asset, then removes body, reactions and file access when the author deletes', async () => {
    const a = await asset(users.a, 'chat');
    const id = await message(users.a, conversationA, a.id);
    expect(
      await as(users.b, 'select * from public.upload_assets where id=$1', [a.id]),
    ).toHaveLength(1);
    await as(
      users.b,
      "insert into public.message_reactions(message_id,user_id,emoji) values($1,$2,'heart')",
      [id, users.b],
    );
    await expect(as(users.b, 'select public.delete_message($1)', [id])).rejects.toThrow(
      'not_found',
    );
    await as(users.a, 'select public.delete_message($1)', [id]);
    const row = (
      await as<{ body: string; deleted_at: string; asset_id: string | null }>(
        users.b,
        'select * from public.messages where id=$1',
        [id],
      )
    )[0];
    expect(row.body).toBe('');
    expect(row.deleted_at).toBeTruthy();
    expect(row.asset_id).toBeNull();
    expect(
      await as(users.b, 'select * from public.message_reactions where message_id=$1', [id]),
    ).toEqual([]);
    expect(await as(users.b, 'select * from public.upload_assets where id=$1', [a.id])).toEqual([]);
  });
  it('uses server read times and forbids client-forged read receipts', async () => {
    await message();
    await as(users.b, 'select public.mark_conversation_read($1)', [conversationA]);
    expect(
      await as(users.a, 'select * from public.conversation_reads where user_id=$1', [users.b]),
    ).toHaveLength(1);
    await expect(
      as(users.c, 'select public.mark_conversation_read($1)', [conversationA]),
    ).rejects.toThrow('forbidden');
    await expect(
      as(users.b, "update public.conversation_reads set last_read_at=now()+interval '1 year'"),
    ).rejects.toThrow(/permission denied/);
  });
  it('blocks the 41st successful message attempt in a database rate window', async () => {
    for (let i = 0; i < 40; i++) await message();
    await expect(message()).rejects.toThrow('rate_limited');
    expect(await as(users.b, 'select * from public.messages')).toHaveLength(40);
  });
});
describe('letter release times are a database boundary', () => {
  it('hides the entire scheduled letter and its media from the recipient before release', async () => {
    const a = await asset(users.a, 'letter');
    const id = await letter();
    await as(users.a, 'update public.letters set asset_id=$1 where id=$2', [a.id, id]);
    await as(users.a, "select public.send_letter($1,now()+interval '1 day')", [id]);
    expect(await as(users.b, 'select * from public.letters where id=$1', [id])).toEqual([]);
    expect(await as(users.b, 'select * from public.upload_assets where id=$1', [a.id])).toEqual([]);
    expect(
      (
        await as<{ allowed: boolean }>(users.b, 'select public.can_read_asset($1) as allowed', [
          a.id,
        ])
      )[0].allowed,
    ).toBe(false);
    await expect(as(users.b, 'select public.open_letter($1)', [id])).rejects.toThrow(
      'letter_unavailable',
    );
    expect(await as(users.a, 'select body from public.letters where id=$1', [id])).toHaveLength(1);
  });
  it('locks sender, recipient, body, and release time after send', async () => {
    const id = await letter();
    await as(users.a, "select public.send_letter($1,now()+interval '1 day')", [id]);
    await expect(
      as(users.a, 'update public.letters set release_at=now() where id=$1', [id]),
    ).rejects.toThrow(/permission denied/);
    expect(
      await as(users.a, "update public.letters set body='changed' where id=$1 returning id", [id]),
    ).toEqual([]);
    await expect(
      as(users.a, 'update public.letters set recipient_id=$1 where id=$2', [users.c, id]),
    ).rejects.toThrow(/permission denied/);
  });
  it('reveals only at release, records an opening, and still denies another couple', async () => {
    const id = await letter();
    await as(users.a, 'select public.send_letter($1,now())', [id]);
    expect(await as(users.b, 'select body from public.letters where id=$1', [id])).toEqual([
      { body: 'Synthetic private body' },
    ]);
    expect(await as(users.c, 'select * from public.letters where id=$1', [id])).toEqual([]);
    await as(users.b, 'select public.open_letter($1)', [id]);
    const state = (
      await as<{ state: string; opened_at: string }>(
        users.a,
        'select state,opened_at from public.letters where id=$1',
        [id],
      )
    )[0];
    expect(state.state).toBe('opened');
    expect(state.opened_at).toBeTruthy();
    await expect(as(users.a, 'select public.cancel_letter($1)', [id])).rejects.toThrow(
      'invalid_letter_state',
    );
  });
  it('makes due letters readable independently of a delayed notification job', async () => {
    const id = await letter();
    await as(users.a, "select public.send_letter($1,now()+interval '1 day')", [id]);
    await db.exec('alter table public.letters disable trigger validate_letter');
    await db.query("update public.letters set release_at=now()-interval '1 second' where id=$1", [
      id,
    ]);
    await db.exec('alter table public.letters enable trigger validate_letter');
    expect(await as(users.b, 'select body from public.letters where id=$1', [id])).toHaveLength(1);
    await service('select public.process_due_reminders(100)');
    await service('select public.process_due_reminders(100)');
    expect(
      await as(users.b, "select * from public.notifications where category='letters'"),
    ).toHaveLength(1);
  });
});
describe('explicit mood visibility and owner-only notes', () => {
  it('shares only a chosen unexpired mood, never its private note', async () => {
    const params = ['happy', 'Sensitive synthetic note', false];
    const id = (
      await as<{ id: string }>(
        users.a,
        "select public.save_mood($1,$2,$3,now()+interval '24 hours',current_date) as id",
        params,
      )
    )[0].id;
    expect(await as(users.b, 'select * from public.daily_moods where id=$1', [id])).toEqual([]);
    await as(
      users.a,
      "select public.save_mood('calm','Sensitive synthetic note',true,now()+interval '24 hours',current_date)",
    );
    expect(await as(users.b, 'select * from public.daily_moods where id=$1', [id])).toHaveLength(1);
    expect(await as(users.b, 'select * from public.mood_notes where mood_id=$1', [id])).toEqual([]);
    expect(await as(users.c, 'select * from public.daily_moods where id=$1', [id])).toEqual([]);
    await as(
      users.a,
      "select public.save_mood('calm','Sensitive synthetic note',false,now()+interval '24 hours',current_date)",
    );
    expect(await as(users.b, 'select * from public.daily_moods where id=$1', [id])).toEqual([]);
  });
  it('expires partner visibility while keeping the owner’s history', async () => {
    const id = (
      await as<{ id: string }>(
        users.a,
        "select public.save_mood('tired','',true,now()+interval '1 hour',current_date) as id",
      )
    )[0].id;
    await db.exec('alter table public.daily_moods disable trigger mood_expiry');
    await db.query(
      "update public.daily_moods set expires_at=now()-interval '1 minute' where id=$1",
      [id],
    );
    await db.exec('alter table public.daily_moods enable trigger mood_expiry');
    expect(await as(users.b, 'select * from public.daily_moods where id=$1', [id])).toEqual([]);
    expect(await as(users.a, 'select * from public.daily_moods where id=$1', [id])).toHaveLength(1);
  });
});
describe('reproductive health is a separate security boundary', () => {
  it('prevents even the invited partner from reading any private cycle table by default', async () => {
    await as(
      users.a,
      "insert into public.period_records(owner_id,start_date,notes,symptoms) values($1,'2026-06-01','Private synthetic note',array['test symptom'])",
      [users.a],
    );
    await as(
      users.a,
      "insert into public.cycle_reminders(owner_id,kind,enabled,due_at,timezone) values($1,'log',false,now()+interval '1 day','Europe/London')",
      [users.a],
    );
    for (const table of [
      'period_records',
      'cycle_settings',
      'cycle_reminders',
      'cycle_sharing_preferences',
    ]) {
      expect(
        await as(users.b, `select * from public.${table} where owner_id=$1`, [users.a]),
      ).toEqual([]);
      expect(
        await as(users.c, `select * from public.${table} where owner_id=$1`, [users.a]),
      ).toEqual([]);
    }
    expect(await as(users.b, 'select * from public.get_partner_cycle_share()')).toEqual([]);
  });
  it('denies forged ownership on health inserts and updates', async () => {
    await expect(
      as(
        users.b,
        "insert into public.period_records(owner_id,start_date) values($1,'2026-01-01')",
        [users.a],
      ),
    ).rejects.toThrow(/row-level security/);
    expect(
      await as(
        users.b,
        'update public.cycle_settings set prediction_enabled=true where owner_id=$1 returning *',
        [users.a],
      ),
    ).toEqual([]);
  });
  it('exposes only independent, opt-in status/date projections and supports immediate revocation', async () => {
    await as(
      users.a,
      "insert into public.period_records(owner_id,start_date,notes) values($1,'2026-06-01','Never share me')",
      [users.a],
    );
    await as(
      users.a,
      "update public.cycle_sharing_preferences set share_status=true,status_text='A little extra care',share_estimate=false,approximate_date='2026-07-01' where owner_id=$1",
      [users.a],
    );
    const status = await as(users.b, 'select * from public.get_partner_cycle_share()');
    expect(status).toEqual([
      { owner_id: users.a, status_text: 'A little extra care', approximate_date: null },
    ]);
    await as(
      users.a,
      'update public.cycle_sharing_preferences set share_status=false,share_estimate=true where owner_id=$1',
      [users.a],
    );
    const date = await as(users.b, 'select * from public.get_partner_cycle_share()');
    expect(date).toEqual([
      { owner_id: users.a, status_text: null, approximate_date: new Date('2026-07-01T00:00:00Z') },
    ]);
    expect(
      await as(users.b, 'select * from public.period_records where owner_id=$1', [users.a]),
    ).toEqual([]);
    await as(
      users.a,
      'update public.cycle_sharing_preferences set share_status=false,share_estimate=false where owner_id=$1',
      [users.a],
    );
    expect(await as(users.b, 'select * from public.get_partner_cycle_share()')).toEqual([]);
  });
  it('deletes all owned cycle records/reminders/sharing without touching the partner’s data', async () => {
    for (const owner of [users.a, users.b])
      await as(
        owner,
        "insert into public.period_records(owner_id,start_date) values($1,'2026-01-01')",
        [owner],
      );
    await as(
      users.a,
      'update public.cycle_sharing_preferences set share_status=true where owner_id=$1',
      [users.a],
    );
    await as(users.a, 'select public.delete_cycle_data()');
    expect(await as(users.a, 'select * from public.period_records')).toEqual([]);
    expect(await as(users.b, 'select * from public.period_records')).toHaveLength(1);
    expect(await as(users.b, 'select * from public.get_partner_cycle_share()')).toEqual([]);
  });
});
describe('atomic mutations and direct-write validation', () => {
  it('changes a reaction without a delete/insert gap and rejects outsiders', async () => {
    const id = await message(users.a, conversationA);
    await as(users.b, 'select public.set_message_reaction($1,$2)', [id, 'heart']);
    await as(users.b, 'select public.set_message_reaction($1,$2)', [id, 'hug']);
    expect(
      await as(users.a, 'select emoji from public.message_reactions where message_id=$1', [id]),
    ).toEqual([{ emoji: 'hug' }]);
    await expect(
      as(users.c, 'select public.set_message_reaction($1,$2)', [id, 'heart']),
    ).rejects.toThrow('not_found');
    await expect(
      as(users.b, 'select public.set_message_reaction($1,$2)', [id, 'invalid']),
    ).rejects.toThrow();
    expect(
      await as(users.a, 'select emoji from public.message_reactions where message_id=$1', [id]),
    ).toEqual([{ emoji: 'hug' }]);
    await as(users.b, 'select public.set_message_reaction($1,null)', [id]);
    expect(
      await as(users.a, 'select emoji from public.message_reactions where message_id=$1', [id]),
    ).toEqual([]);
  });
  it('atomically replaces an RSVP while pinning the participant and checking membership', async () => {
    const id = crypto.randomUUID();
    await as(
      users.a,
      "insert into public.events(id,couple_id,creator_id,title,starts_at,timezone) values($1,$2,$3,'Synthetic RSVP','2026-10-30T18:00:00Z','Europe/London')",
      [id, coupleA, users.a],
    );
    await as(users.b, 'select public.set_event_response($1,$2)', [id, 'yes']);
    await as(users.b, 'select public.set_event_response($1,$2)', [id, 'maybe']);
    expect(
      await as(users.a, 'select user_id,response from public.event_responses where event_id=$1', [
        id,
      ]),
    ).toEqual([{ user_id: users.b, response: 'maybe' }]);
    await expect(
      as(users.c, 'select public.set_event_response($1,$2)', [id, 'no']),
    ).rejects.toThrow('not_found');
  });
  it('rejects future period records even when bypassing the Next.js API', async () => {
    await expect(
      as(
        users.a,
        "insert into public.period_records(owner_id,start_date) values($1,'2099-01-01')",
        [users.a],
      ),
    ).rejects.toThrow('invalid_date');
  });
  it('requires exclusive local-midnight boundaries for all-day events', async () => {
    await expect(
      as(
        users.a,
        "insert into public.events(couple_id,creator_id,title,starts_at,timezone,all_day) values($1,$2,'Synthetic','2026-10-30T18:00:00Z','Europe/London',true)",
        [coupleA, users.a],
      ),
    ).rejects.toThrow('invalid_date');
  });
  it('keeps the cleanup acknowledgement callable only by the trusted worker', async () => {
    await expect(as(users.a, "select public.finish_cleanup_paths(array['fake'])")).rejects.toThrow(
      'permission denied',
    );
  });
});
describe('account deletion across foreign-key cascades', () => {
  it('erases a solo space and its relationship date when its last account is deleted', async () => {
    const invitation = await soloInvitation();
    await as(users.e, "update public.couples set relationship_start='2020-01-01' where id=$1", [
      invitation.couple,
    ]);
    await db.query('delete from auth.users where id=$1', [users.e]);
    expect(
      (await db.query('select id from public.couples where id=$1', [invitation.couple])).rows,
    ).toEqual([]);
    expect(
      (
        await db.query('select id from public.conversations where couple_id=$1', [
          invitation.couple,
        ])
      ).rows,
    ).toEqual([]);
  });
  it('retains shared metadata for the remaining partner, then erases it after both leave', async () => {
    const invitation = await soloInvitation();
    await as(users.f, 'select public.accept_invitation($1)', [invitation.hash]);
    const conversation = (
      await as<{ id: string }>(users.f, 'select id from public.conversations')
    )[0].id;
    await message(users.f, conversation);
    await db.query('delete from auth.users where id=$1', [users.e]);
    expect(
      await as(users.f, 'select id from public.couples where id=$1', [invitation.couple]),
    ).toHaveLength(1);
    await db.query('delete from auth.users where id=$1', [users.f]);
    expect(
      (await db.query('select id from public.couples where id=$1', [invitation.couple])).rows,
    ).toEqual([]);
    expect(
      (await db.query('select id from public.messages where conversation_id=$1', [conversation]))
        .rows,
    ).toEqual([]);
  });

  it('removes an account with attachment-only messages without breaking constraints or deleting the partner’s messages', async () => {
    const invitation = await soloInvitation();
    await as(users.f, 'select public.accept_invitation($1)', [invitation.hash]);
    const conversation = (
      await as<{ id: string }>(users.e, 'select id from public.conversations')
    )[0].id;
    const upload = await asset(users.e, 'chat');
    await as(
      users.e,
      "insert into public.messages(conversation_id,sender_id,body,asset_id) values($1,$2,'',$3)",
      [conversation, users.e, upload.id],
    );
    const retained = await message(users.f, conversation);
    await db.query('delete from auth.users where id=$1', [users.e]);
    expect((await db.query('select * from public.profiles where id=$1', [users.e])).rows).toEqual(
      [],
    );
    expect(
      (await db.query('select * from public.upload_assets where owner_id=$1', [users.e])).rows,
    ).toEqual([]);
    expect(
      await as(users.f, 'select id from public.messages where id=$1', [retained]),
    ).toHaveLength(1);
  });
});
describe('calendar, notification preferences and reveal-protected games', () => {
  it('creates shared events and validates timezone, ownership and RSVP access', async () => {
    const id = (
      await as<{ id: string }>(
        users.a,
        "insert into public.events(couple_id,creator_id,title,starts_at,timezone) values($1,$2,'Synthetic date','2026-12-01T18:00:00Z','Europe/London') returning id",
        [coupleA, users.a],
      )
    )[0].id;
    expect(await as(users.b, 'select * from public.events where id=$1', [id])).toHaveLength(1);
    expect(await as(users.c, 'select * from public.events where id=$1', [id])).toEqual([]);
    expect(
      await as(users.b, "update public.events set title='changed' where id=$1 returning id", [id]),
    ).toEqual([]);
    await expect(
      as(
        users.a,
        "insert into public.events(couple_id,creator_id,title,starts_at,timezone) values($1,$2,'Bad',now(),'Not/AZone')",
        [coupleA, users.a],
      ),
    ).rejects.toThrow('invalid_timezone');
  });
  it('preserves weekly London wall-clock time across DST and skips invalid monthly dates', async () => {
    const weekly = (
      await service<{ next: string }>(
        "select public.next_event_occurrence('2026-03-22T09:00:00Z','Europe/London','FREQ=WEEKLY','2026-03-22T09:00:00Z') as next",
      )
    )[0].next;
    expect(new Date(weekly).toISOString()).toBe('2026-03-29T08:00:00.000Z');
    const monthly = (
      await service<{ next: string }>(
        "select public.next_event_occurrence('2026-01-31T09:00:00Z','Europe/London','FREQ=MONTHLY','2026-01-31T09:00:00Z') as next",
      )
    )[0].next;
    expect(new Date(monthly).toISOString()).toBe('2026-03-31T08:00:00.000Z');
  });
  it('respects category preferences and produces no sensitive notification payloads', async () => {
    await as(users.b, 'update public.notification_preferences set chat=false where owner_id=$1', [
      users.b,
    ]);
    await message();
    expect(await as(users.b, "select * from public.notifications where category='chat'")).toEqual(
      [],
    );
    await as(
      users.a,
      "insert into public.cycle_reminders(owner_id,kind,enabled,due_at,timezone) values($1,'estimate',true,now()-interval '1 minute','UTC')",
      [users.a],
    );
    await service('select public.process_due_reminders(100)');
    expect(await as(users.a, "select * from public.notifications where category='cycle'")).toEqual(
      [],
    );
    await as(users.a, 'update public.notification_preferences set cycle=true where owner_id=$1', [
      users.a,
    ]);
    await as(
      users.a,
      "insert into public.cycle_reminders(owner_id,kind,enabled,due_at,timezone) values($1,'supplies',true,now()-interval '1 minute','UTC')",
      [users.a],
    );
    await service('select public.process_due_reminders(100)');
    const notices = await as(users.a, "select * from public.notifications where category='cycle'");
    expect(notices).toHaveLength(1);
    expect(notices[0].kind).toBe('private_reminder');
    expect(JSON.stringify(notices)).not.toMatch(/symptoms|supplies|estimate|notes|period_records/);
    expect(
      await as(users.b, 'select * from public.notifications where owner_id=$1', [users.a]),
    ).toEqual([]);
  });
  it('denies direct notification spoofing and private push endpoint SSRF', async () => {
    await expect(
      as(
        users.a,
        "insert into public.notifications(owner_id,category,kind,href,dedupe_key) values($1,'chat','message','/chat','forged')",
        [users.b],
      ),
    ).rejects.toThrow(/permission denied/);
    const sub = {
      endpoint: 'https://127.0.0.1/secrets',
      keys: { p256dh: 'a'.repeat(87), auth: 'a'.repeat(22) },
    };
    await expect(
      as(
        users.a,
        "insert into public.notification_subscriptions(owner_id,device_id,transport,subscription) values($1,gen_random_uuid(),'web',$2)",
        [users.a, JSON.stringify(sub)],
      ),
    ).rejects.toThrow(/valid_subscription/);
  });
  it('hides game answers until both submit; rejects duplicates and nonmembers', async () => {
    const id = (await as<{ id: string }>(users.a, "select public.start_game('know') as id"))[0].id;
    await as(users.a, 'select public.answer_game($1,$2)', [
      id,
      JSON.stringify({ own: 'Tea', guess: 'Coffee' }),
    ]);
    expect(
      await as(users.b, 'select * from public.game_answers where session_id=$1', [id]),
    ).toEqual([]);
    await expect(
      as(users.a, 'select public.answer_game($1,$2)', [
        id,
        JSON.stringify({ own: 'Changed', guess: 'Changed' }),
      ]),
    ).rejects.toThrow(/duplicate key/);
    await expect(
      as(users.c, 'select public.answer_game($1,$2)', [
        id,
        JSON.stringify({ own: 'No', guess: 'No' }),
      ]),
    ).rejects.toThrow('invalid_game');
    await as(users.b, 'select public.answer_game($1,$2)', [
      id,
      JSON.stringify({ own: 'Coffee', guess: 'Tea' }),
    ]);
    expect(
      await as(users.a, 'select * from public.game_answers where session_id=$1', [id]),
    ).toHaveLength(2);
    expect(
      await as(users.c, 'select * from public.game_answers where session_id=$1', [id]),
    ).toEqual([]);
  });
  it('requires independent consent from both people for daily answers and only then saves a memory', async () => {
    const id = (await as<{ id: string }>(users.a, "select public.start_game('daily') as id"))[0].id;
    await as(users.a, "select public.answer_game($1,'A fictional answer')", [id]);
    await as(users.b, "select public.answer_game($1,'Another fictional answer')", [id]);
    expect(
      await as(users.a, 'select * from public.game_answers where session_id=$1', [id]),
    ).toHaveLength(1);
    await expect(as(users.a, 'select public.save_game_memory($1)', [id])).rejects.toThrow(
      'answers_private',
    );
    await as(users.a, 'select public.reveal_answer($1)', [id]);
    expect(
      await as(users.a, 'select * from public.game_answers where session_id=$1', [id]),
    ).toHaveLength(1);
    await as(users.b, 'select public.reveal_answer($1)', [id]);
    expect(
      await as(users.a, 'select * from public.game_answers where session_id=$1', [id]),
    ).toHaveLength(2);
    const saved = (
      await as<{ id: string }>(users.a, 'select public.save_game_memory($1) as id', [id])
    )[0].id;
    expect(await as(users.b, 'select * from public.memories where id=$1', [saved])).toHaveLength(1);
  });
  it('validates This or That choices and does not permit direct answer edits', async () => {
    const id = (await as<{ id: string }>(users.a, "select public.start_game('choice') as id"))[0]
      .id;
    await expect(as(users.a, "select public.answer_game($1,'invalid')", [id])).rejects.toThrow(
      'invalid_answer',
    );
    await as(users.a, "select public.answer_game($1,'0')", [id]);
    await expect(
      as(users.a, "update public.game_answers set answer='1' where session_id=$1", [id]),
    ).rejects.toThrow(/permission denied/);
  });
});
