/**
 * Tests supabase/functions/push/handler.ts with an in-memory stand-in for the database and a fake
 * Expo push service. No local stack needed:
 *
 *   npx tsx supabase/tests/push_function.test.ts
 *
 * The SQL side (trigger, RPCs, token rules) is covered by applying the migration; this checks the
 * sending rules: once per notification, fresh ones only, wording, batching, dead-token cleanup.
 */
import assert from 'node:assert/strict';

import { composeMessage, handle, MAX_AGE_MS, type Deps, type ExpoMessage, type ExpoTicket } from '../functions/push/handler';

const NOW = Date.parse('2026-10-01T12:00:00Z');
const N_ID = '11111111-1111-4111-8111-111111111111';

type Notification = {
  id: string;
  recipient_id: string;
  type: string;
  actor_id: string | null;
  reel_id: string | null;
  comment_id: string | null;
  body: string | null;
  created_at: string;
  pushed_at: string | null;
};

/** Just enough of the Supabase query builder for the handler's calls. */
function fakeDb(state: { notifications: Notification[]; tokens: { token: string; user_id: string }[] }) {
  const resolve = (q: { table: string; op: string; filters: Record<string, unknown> }) => {
    const f = q.filters;
    if (q.table === 'notifications' && q.op === 'update') {
      const n = state.notifications.find(
        (x) => x.id === f['eq:id'] && x.pushed_at === null && x.created_at >= String(f['gte:created_at']),
      );
      if (!n) return { data: null, error: null };
      n.pushed_at = new Date(NOW).toISOString();
      return { data: n, error: null };
    }
    if (q.table === 'push_tokens' && q.op === 'select')
      return { data: state.tokens.filter((t) => t.user_id === f['eq:user_id']), error: null };
    if (q.table === 'push_tokens' && q.op === 'delete') {
      const dead = f['in:token'] as string[];
      state.tokens = state.tokens.filter((t) => !dead.includes(t.token));
      return { data: null, error: null };
    }
    if (q.table === 'profiles') return { data: { username: 'skillzone' }, error: null };
    if (q.table === 'comments') return { data: { body: 'What   a\nfinish!' }, error: null };
    throw new Error(`unexpected query on ${q.table}`);
  };

  return {
    from(table: string) {
      const q = { table, op: 'select', filters: {} as Record<string, unknown> };
      const chain: unknown = new Proxy(
        {},
        {
          get(_, prop: string) {
            if (prop === 'then')
              return (ok: (v: unknown) => void, bad: (e: unknown) => void) => Promise.resolve(resolve(q)).then(ok, bad);
            if (prop === 'maybeSingle') return () => Promise.resolve(resolve(q));
            return (...args: unknown[]) => {
              if (prop === 'update' || prop === 'delete') q.op = prop;
              if (['eq', 'is', 'gte', 'in'].includes(prop)) q.filters[`${prop}:${args[0]}`] = args[1];
              return chain;
            };
          },
        },
      );
      return chain;
    },
  } as unknown as Deps['db'];
}

const notification = (over: Partial<Notification> = {}): Notification => ({
  id: N_ID,
  recipient_id: 'owner',
  type: 'comment',
  actor_id: 'actor',
  reel_id: 'reel-1',
  comment_id: 'comment-1',
  body: null,
  created_at: new Date(NOW - 5_000).toISOString(),
  pushed_at: null,
  ...over,
});

const call = (deps: Deps, body: unknown, method = 'POST') =>
  handle(new Request('http://x/functions/v1/push', { method, body: method === 'POST' ? JSON.stringify(body) : undefined }), deps).then(
    async (r) => ({ status: r.status, body: await r.json() }),
  );

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

async function main() {
await test('wording and tap data for each type', () => {
  const base = { id: N_ID, reel_id: 'r', body: null };
  assert.equal(composeMessage({ ...base, type: 'cheer' }, 'ada', null)?.body, '@ada cheered your Moment ⚽');
  assert.equal(composeMessage({ ...base, type: 'new_fan' }, 'ada', null)?.body, '@ada became your Fan');
  assert.equal(composeMessage({ ...base, type: 'comment' }, 'ada', 'Nice')?.body, '@ada commented: "Nice"');
  assert.equal(composeMessage({ ...base, type: 'comment' }, 'ada', null)?.body, '@ada commented on your Moment');
  assert.equal(composeMessage({ ...base, type: 'comment' }, 'ada', 'x'.repeat(300))?.body.length, '@ada commented: ""'.length + 120);
  assert.deepEqual(composeMessage({ ...base, type: 'system', body: 'Welcome!' }, null, null), {
    title: 'GamePulse',
    body: 'Welcome!',
    data: { notificationId: N_ID, type: 'system', reelId: 'r', actorUsername: null },
  });
  assert.equal(composeMessage({ ...base, type: 'cheer' }, null, null), null, 'deleted actor sends nothing');
});

await test('sends once to every device, then never again', async () => {
  const state = { notifications: [notification()], tokens: [{ token: 'ExponentPushToken[a]', user_id: 'owner' }, { token: 'ExponentPushToken[b]', user_id: 'owner' }, { token: 'ExponentPushToken[z]', user_id: 'someone-else' }] };
  const sent: ExpoMessage[] = [];
  const deps: Deps = { db: fakeDb(state), now: () => NOW, send: async (m) => (sent.push(...m), m.map(() => ({ status: 'ok', id: 't' }) as ExpoTicket)) };

  assert.deepEqual((await call(deps, { id: N_ID })).body, { sent: 2 });
  assert.deepEqual(sent.map((m) => m.to), ['ExponentPushToken[a]', 'ExponentPushToken[b]']);
  assert.equal(sent[0].body, '@skillzone commented: "What a finish!"');
  assert.equal(sent[0].channelId, 'default');
  assert.equal(sent[0].data.reelId, 'reel-1');

  const again = await call(deps, { id: N_ID });
  assert.equal(again.body.ignored !== undefined, true, 'second call is ignored');
  assert.equal(sent.length, 2);
});

await test('stale notifications are not pushed', async () => {
  const state = { notifications: [notification({ created_at: new Date(NOW - MAX_AGE_MS - 1_000).toISOString() })], tokens: [{ token: 'ExponentPushToken[a]', user_id: 'owner' }] };
  let calls = 0;
  const deps: Deps = { db: fakeDb(state), now: () => NOW, send: async (m) => (calls++, m.map(() => ({ status: 'ok', id: 't' }) as ExpoTicket)) };
  assert.ok((await call(deps, { id: N_ID })).body.ignored);
  assert.equal(calls, 0);
});

await test('drops tokens Expo says are gone, batches by 100', async () => {
  const tokens = Array.from({ length: 150 }, (_, i) => ({ token: `ExponentPushToken[t${i}]`, user_id: 'owner' }));
  const state = { notifications: [notification({ type: 'cheer', comment_id: null })], tokens };
  const batches: number[] = [];
  const deps: Deps = {
    db: fakeDb(state),
    now: () => NOW,
    send: async (m) => {
      batches.push(m.length);
      return m.map((msg) =>
        msg.to === 'ExponentPushToken[t3]' || msg.to === 'ExponentPushToken[t120]'
          ? ({ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } } as ExpoTicket)
          : ({ status: 'ok', id: 't' } as ExpoTicket),
      );
    },
  };
  assert.deepEqual((await call(deps, { id: N_ID })).body, { sent: 148 });
  assert.deepEqual(batches, [100, 50]);
  assert.equal(state.tokens.length, 148);
  assert.ok(!state.tokens.some((t) => t.token === 'ExponentPushToken[t3]'));
});

await test('rejects bad input', async () => {
  const deps: Deps = { db: fakeDb({ notifications: [], tokens: [] }), send: async () => [] };
  assert.equal((await call(deps, { id: 'nope' })).status, 400);
  assert.equal((await call(deps, {}, 'GET')).status, 405);
  assert.ok((await call(deps, { id: N_ID })).body.ignored, 'unknown id is ignored');
});

console.log(`\n${passed} push function tests passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
