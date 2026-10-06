/**
 * Tests supabase/functions/account/handler.ts with in-memory stand-ins. No local stack needed:
 *
 *   npx tsx supabase/tests/account_function.test.ts
 *
 * Checks who may delete, what gets deleted and in which order, and that a Bunny outage doesn't
 * stop someone leaving. The cascade from the login to every row is the schema's job (all foreign
 * keys to profiles are ON DELETE CASCADE).
 */
import assert from 'node:assert/strict';

import { handle, type Deps } from '../functions/account/handler';

const ME = 'aaaaaaaa-0000-0000-0000-000000000001';

type Log = string[];

function fakeDeps(opts: { reels: { video_provider: string | null; video_asset_id: string | null }[]; photos: string[]; failVideo?: string; bunny?: boolean }) {
  const log: Log = [];
  const db = {
    from(table: string) {
      const q: { op: string; filters: Record<string, unknown> } = { op: 'select', filters: {} };
      const chain: unknown = new Proxy(
        {},
        {
          get(_, prop: string) {
            if (prop === 'then') {
              return (ok: (v: unknown) => void) => {
                if (table === 'reels' && q.op === 'select') return ok({ data: opts.reels, error: null });
                if (table === 'reels' && q.op === 'delete') {
                  log.push(`delete reels of ${q.filters.user_id}`);
                  return ok({ data: null, error: null });
                }
                throw new Error(`unexpected ${q.op} on ${table}`);
              };
            }
            return (...args: unknown[]) => {
              if (prop === 'delete') q.op = 'delete';
              if (prop === 'eq') q.filters[String(args[0])] = args[1];
              return chain;
            };
          },
        },
      );
      return chain;
    },
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string) => {
          log.push(`list ${bucket}/${folder}`);
          return { data: opts.photos.map((name) => ({ name })), error: null };
        },
        remove: async (paths: string[]) => {
          log.push(`remove ${paths.join(',')}`);
          return { data: null, error: null };
        },
      }),
    },
  } as unknown as Deps['db'];

  const deps: Deps = {
    db,
    userIdFromToken: async (t) => (t === 'good' ? ME : null),
    deleteVideo:
      opts.bunny === false
        ? null
        : async (guid) => {
            if (guid === opts.failVideo) throw new Error('bunny down');
            log.push(`bunny delete ${guid}`);
          },
    deleteUser: async (id) => void log.push(`delete user ${id}`),
  };
  return { deps, log };
}

const call = (deps: Deps, body: unknown, token: string | null = 'good', method = 'POST') =>
  handle(
    new Request('http://x/functions/v1/account', {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: method === 'POST' ? JSON.stringify(body) : undefined,
    }),
    deps,
  ).then(async (r) => ({ status: r.status, body: await r.json() }));

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

async function main() {
  await test('deletes videos, reels, photos, then the login, in that order', async () => {
    const { deps, log } = fakeDeps({
      reels: [
        { video_provider: 'bunny', video_asset_id: 'v1' },
        { video_provider: 'bunny', video_asset_id: 'v2' },
        { video_provider: 'bunny', video_asset_id: null },
      ],
      photos: ['1.jpg', '2.jpg'],
    });
    const res = await call(deps, { action: 'delete' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { deleted: true, videos: 2, videosFailed: 0, photos: 2 });
    assert.deepEqual(log, [
      'bunny delete v1',
      'bunny delete v2',
      `delete reels of ${ME}`,
      `list avatars/${ME}`,
      `remove ${ME}/1.jpg,${ME}/2.jpg`,
      `delete user ${ME}`,
    ]);
  });

  await test('a Bunny failure is counted but the account is still deleted', async () => {
    const { deps, log } = fakeDeps({
      reels: [
        { video_provider: 'bunny', video_asset_id: 'v1' },
        { video_provider: 'bunny', video_asset_id: 'v2' },
      ],
      photos: [],
      failVideo: 'v1',
    });
    const res = await call(deps, { action: 'delete' });
    assert.equal(res.status, 200);
    assert.equal(res.body.videosFailed, 1);
    assert.ok(log.includes(`delete user ${ME}`));
    assert.ok(!log.some((l) => l.startsWith('remove')), 'no photos, no remove call');
  });

  await test('without Bunny configured, still deletes the account', async () => {
    const { deps, log } = fakeDeps({ reels: [{ video_provider: 'bunny', video_asset_id: 'v1' }], photos: [], bunny: false });
    const res = await call(deps, { action: 'delete' });
    assert.equal(res.status, 200);
    assert.equal(res.body.videosFailed, 1);
    assert.ok(log.includes(`delete user ${ME}`));
  });

  await test('refuses signed-out, bad token, wrong action and GET', async () => {
    const { deps, log } = fakeDeps({ reels: [], photos: [] });
    assert.equal((await call(deps, { action: 'delete' }, null)).status, 401);
    assert.equal((await call(deps, { action: 'delete' }, 'forged')).status, 401);
    assert.equal((await call(deps, { action: 'nuke' })).status, 400);
    assert.equal((await call(deps, {}, 'good', 'GET')).status, 405);
    assert.deepEqual(log, [], 'nothing deleted');
  });

  console.log(`\n${passed} account function tests passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
