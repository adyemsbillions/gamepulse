/**
 * Tests supabase/functions/videos/handler.ts against a real PostgREST + the GamePulse migrations,
 * with a fake Bunny Stream API. Local only (see README.md in this folder):
 *
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321 JWT_SECRET=<local jwt secret> npx tsx supabase/tests/videos_function.test.ts
 *
 * Expects the seeded local stack used by api_smoke.test.ts (users A and B, A onboarded).
 */
import { createHash, createHmac, randomUUID } from 'node:crypto';
import http from 'node:http';

import { createClient } from '@supabase/supabase-js';

import { handle, LIMITS, type BunnyConfig, type Deps } from '../functions/videos/handler';

const URL_ = process.env.SUPABASE_TEST_URL ?? 'http://localhost:3301';
const SECRET = process.env.JWT_SECRET ?? 'a-very-long-local-test-secret-at-least-32-chars';
const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(role: string, sub?: string) {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, sub, exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}
const client = (token: string) =>
  createClient(URL_, 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

// ---------------------------------------------------------------- fake Bunny
type FakeVideo = { guid: string; status: number; length: number; thumbnailFileName: string };
const videos = new Map<string, FakeVideo>();
let failCreates = false;
const bunnyCalls: string[] = [];

const bunnyServer = http.createServer((req, res) => {
  bunnyCalls.push(`${req.method} ${req.url}`);
  const send = (status: number, body?: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  if (req.headers.accesskey !== 'lib-key') return send(401, { message: 'bad key' });
  const m = req.url?.match(/^\/library\/777\/videos(?:\/([\w-]+))?$/);
  if (!m) return send(404);
  const guid = m[1];
  if (req.method === 'POST' && !guid) {
    if (failCreates) return send(500, { message: 'boom' });
    const v = { guid: randomUUID(), status: 0, length: 0, thumbnailFileName: 'thumbnail.jpg' };
    videos.set(v.guid, v);
    return send(200, v);
  }
  const v = guid ? videos.get(guid) : undefined;
  if (!v) return send(404, { message: 'not found' });
  if (req.method === 'GET') return send(200, v);
  if (req.method === 'DELETE') {
    videos.delete(v.guid);
    return send(200, { success: true });
  }
  send(405);
});

const bunny: BunnyConfig = {
  libraryId: '777',
  apiKey: 'lib-key',
  cdnHost: 'vz-test.b-cdn.net',
  webhookKey: 'readonly-key',
  apiBase: 'http://127.0.0.1:3399',
};

const service = client(jwt('service_role'));
const deps: Deps = {
  db: service,
  bunny,
  userIdFromToken: async (t) => (t.startsWith('user:') ? t.slice(5) : null),
};

async function call(body: unknown, user: string | null, path = '/functions/v1/videos', headers: Record<string, string> = {}) {
  const res = await handle(
    new Request(`http://fn${path}`, {
      method: 'POST',
      headers: { ...(user ? { Authorization: `Bearer user:${user}` } : {}), ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    deps,
  );
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

function hook(payload: object, key = bunny.webhookKey!) {
  const raw = JSON.stringify(payload);
  const sig = createHmac('sha256', key).update(raw).digest('hex');
  return call(raw, null, '/functions/v1/videos/webhook', { 'X-BunnyStream-Signature': sig });
}

const reelRow = async (id: string) =>
  (await service.from('reels').select('*, tags:reel_hashtags(tag)').eq('id', id).maybeSingle()).data as Record<
    string,
    any
  > | null;

let failures = 0;
function expect(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` -> ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

async function main() {
  await new Promise<void>((r) => bunnyServer.listen(3399, r));

  // ---- access
  let r = await call({ action: 'create' }, null);
  expect('signed out → 401', r.status === 401, r);
  r = await call({ action: 'create', caption: 'x' }, B);
  expect('not onboarded → 403', r.status === 403 && /profile/.test(r.body.error), r);
  r = await call({ action: 'nope' }, A);
  expect('unknown action → 400', r.status === 400, r);
  r = await call({ action: 'create', caption: 'long', durationSec: 95 }, A);
  expect('over 60 s refused before anything is created', r.status === 400 && videos.size === 0, r);
  r = await call({ action: 'create', caption: 'big', fileSize: 400 * 1024 * 1024 }, A);
  expect('over 300 MB refused', r.status === 400, r);

  // ---- create
  r = await call(
    { action: 'create', caption: '  Rabona from the edge #Golazo  ', tags: ['#Golazo', 'bad tag!', 'SKILLS', 'golazo'], durationSec: 14.2, fileType: 'video/quicktime', fileSize: 1e7 },
    A,
  );
  expect('create → 200', r.status === 200, r);
  const { reelId, upload } = r.body;
  const guid = upload?.headers?.VideoId;
  expect('Bunny video created, titled with the reel id', videos.has(guid) && bunnyCalls.includes('POST /library/777/videos'));
  const expectedSig = createHash('sha256')
    .update(`777lib-key${upload.headers.AuthorizationExpire}${guid}`)
    .digest('hex');
  expect('TUS signature = sha256(library + key + expire + video)', upload.headers.AuthorizationSignature === expectedSig);
  expect('upload expires in ~6 h', Math.abs(Number(upload.headers.AuthorizationExpire) - Date.now() / 1000 - LIMITS.uploadTtlSec) < 60);
  expect('API key never returned', !JSON.stringify(r.body).includes('lib-key'));
  expect('tus metadata', upload.endpoint === 'https://video.bunnycdn.com/tusupload' && upload.metadata.filetype === 'video/quicktime' && upload.metadata.title === reelId, upload);

  let row = await reelRow(reelId);
  expect('reel stored as uploading, owned by A', row?.status === 'uploading' && row?.user_id === A, row);
  expect('reel linked to the Bunny video', row?.video_provider === 'bunny' && row?.video_asset_id === guid);
  expect('caption trimmed', row?.caption === 'Rabona from the edge #Golazo', row?.caption);
  expect('tags cleaned + deduped', row?.tags.map((t: any) => t.tag).sort().join() === 'golazo,skills', row?.tags);

  const anon = client(jwt('anon'));
  const anonSees = (await anon.from('reels').select('id').eq('id', reelId)).data ?? [];
  expect('uploading reel is not public', anonSees.length === 0);

  // ---- refresh (polling from the app)
  r = await call({ action: 'refresh', reelId }, A);
  expect('refresh before upload finishes stays uploading', r.body.status === 'uploading', r);
  videos.get(guid)!.status = 2;
  r = await call({ action: 'refresh', reelId }, A);
  expect('Bunny encoding → processing', r.body.status === 'processing', r);
  r = await call({ action: 'refresh', reelId }, B);
  expect("B can't poll A's reel", r.status === 404, r);
  r = await call({ action: 'refresh', reelId: 'not-a-uuid' }, A);
  expect('bad id → 404', r.status === 404, r);

  // ---- webhook
  videos.get(guid)!.status = 3;
  videos.get(guid)!.length = 14;
  r = await hook({ VideoLibraryId: 777, VideoGuid: guid, Status: 3 }, 'wrong-key');
  expect('webhook with bad signature → 401, nothing changes', r.status === 401 && (await reelRow(reelId))?.status === 'processing', r);
  r = await call(JSON.stringify({ VideoLibraryId: 777, VideoGuid: guid, Status: 3 }), null, '/functions/v1/videos/webhook');
  expect('webhook without signature → 401', r.status === 401, r);
  r = await hook({ VideoLibraryId: 999, VideoGuid: guid, Status: 3 });
  expect('other library ignored', r.status === 200 && r.body.ignored === 'other library', r);
  r = await hook({ VideoLibraryId: 777, VideoGuid: randomUUID(), Status: 3 });
  expect('unknown video ignored', r.body.ignored === 'unknown video', r);

  r = await hook({ VideoLibraryId: 777, VideoGuid: guid, Status: 3 });
  expect('finished webhook → published', r.status === 200 && r.body.status === 'published', r);
  row = await reelRow(reelId);
  expect('playback + thumbnail from the library CDN', row?.playback_url === `https://vz-test.b-cdn.net/${guid}/playlist.m3u8` && row?.thumbnail_url === `https://vz-test.b-cdn.net/${guid}/thumbnail.jpg`, row);
  expect('duration from Bunny', Number(row?.duration_sec) === 14, row?.duration_sec);
  expect('published_at stamped', !!row?.published_at);
  const pub = (await anon.from('reels').select('id').eq('id', reelId)).data ?? [];
  expect('now public', pub.length === 1);

  // Forged "finished" webhook for a video Bunny says is still encoding: nothing happens.
  r = await call({ action: 'create', caption: 'second', durationSec: 10 }, A);
  const second = r.body.reelId;
  const guid2 = r.body.upload.headers.VideoId;
  videos.get(guid2)!.status = 2;
  r = await hook({ VideoLibraryId: 777, VideoGuid: guid2, Status: 3 });
  expect('status comes from Bunny, not the webhook body', r.body.status === 'processing', r);

  // Late webhook after a moderator removed the reel doesn't bring it back.
  await service.from('reels').update({ status: 'removed' }).eq('id', second);
  videos.get(guid2)!.status = 3;
  r = await hook({ VideoLibraryId: 777, VideoGuid: guid2, Status: 3 });
  expect('removed reel stays removed', r.body.status === 'removed' && (await reelRow(second))?.status === 'removed', r);

  // Longer than 60 s once encoded → failed and deleted from Bunny.
  r = await call({ action: 'create', caption: 'sneaky long', durationSec: 20 }, A);
  const third = r.body.reelId;
  const guid3 = r.body.upload.headers.VideoId;
  Object.assign(videos.get(guid3)!, { status: 3, length: 180 });
  r = await hook({ VideoLibraryId: 777, VideoGuid: guid3, Status: 3 });
  expect('too-long video → failed', r.body.status === 'failed', r);
  expect('too-long video deleted from Bunny', !videos.has(guid3));

  // Encoding failed.
  r = await call({ action: 'create', caption: 'broken file' }, A);
  const fourth = r.body.reelId;
  videos.get(r.body.upload.headers.VideoId)!.status = 5;
  r = await call({ action: 'refresh', reelId: fourth }, A);
  expect('Bunny failure → failed', r.body.status === 'failed', r);

  // ---- delete
  r = await call({ action: 'delete', reelId }, B);
  expect("B can't delete A's reel", r.status === 404 && !!(await reelRow(reelId)), r);
  r = await call({ action: 'delete', reelId }, A);
  expect('owner deletes: row gone', r.status === 200 && !(await reelRow(reelId)), r);
  expect('owner deletes: Bunny video gone', !videos.has(guid));

  // ---- Bunny down
  failCreates = true;
  const before = (await service.from('reels').select('id', { count: 'exact', head: true }).eq('user_id', A)).count;
  r = await call({ action: 'create', caption: 'while Bunny is down' }, A);
  const after = (await service.from('reels').select('id', { count: 'exact', head: true }).eq('user_id', A)).count;
  expect('Bunny error → 502, no orphan reel', r.status === 502 && before === after, { r, before, after });
  failCreates = false;

  // ---- daily limit
  const today = (await service.rpc('recent_upload_count', { p_user_id: A })).data as number;
  const fill = Array.from({ length: LIMITS.uploadsPerDay - today }, (_, i) => ({ user_id: A, caption: `filler ${i}` }));
  if (fill.length) await service.from('reels').insert(fill);
  r = await call({ action: 'create', caption: 'one too many' }, A);
  expect('daily upload limit → 429', r.status === 429, r);

  const asUser = client(jwt('authenticated', A));
  const direct = await asUser.rpc('recent_upload_count', { p_user_id: B });
  expect('app users cannot call recent_upload_count', !!direct.error, direct);

  bunnyServer.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL VIDEOS FUNCTION TESTS PASSED');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
