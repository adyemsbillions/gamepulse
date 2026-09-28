/**
 * Exercises src/lib/data/supabase-source.ts against a real PostgREST + the GamePulse migrations.
 * Local only: SUPABASE_TEST_URL points at a proxy that serves /rest/v1; JWT_SECRET signs test tokens.
 */
import { createHmac } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import { createSupabaseSource } from '../../src/lib/data/supabase-source';

const URL = process.env.SUPABASE_TEST_URL ?? 'http://localhost:3301';
const SECRET = process.env.JWT_SECRET ?? 'a-very-long-local-test-secret-at-least-32-chars';
const A = 'aaaaaaaa-0000-0000-0000-000000000001';
const B = 'bbbbbbbb-0000-0000-0000-000000000002';

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(role: string, sub?: string) {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, sub, exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}

function source(sub: string | null) {
  const token = sub ? jwt('authenticated', sub) : jwt('anon');
  const client = createClient(URL, 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return createSupabaseSource(client, async () => sub);
}

let failures = 0;
function expect(label: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : ` -> ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

async function main() {
  const anon = source(null);
  const a = source(A);
  const b = source(B);

  const p1 = await anon.feed({}, null);
  expect('feed page 1 has 10 reels', p1.items.length === 10, p1.items.length);
  expect('feed newest first', p1.items[0].caption === 'Golazo number 1', p1.items[0].caption);
  expect('feed has a next cursor', !!p1.nextCursor);
  const p2 = await anon.feed({}, p1.nextCursor);
  expect('feed page 2 has the remaining 2', p2.items.length === 2 && p2.nextCursor === null, p2);
  expect('pages do not overlap', !p2.items.some((r) => p1.items.find((x) => x.id === r.id)));
  expect('draft never in public feed', ![...p1.items, ...p2.items].some((r) => r.caption === 'secret draft'));

  const r1 = p1.items[0];
  expect('creator embedded', r1.creator.username === 'skillzone' && r1.creator.verified, r1.creator);
  expect('hashtags embedded', r1.hashtags.sort().join() === 'golazo,skills', r1.hashtags);
  expect('counters mapped', r1.cheers === 1 && r1.comments === 1, { c: r1.cheers, m: r1.comments });
  expect('duration numeric', r1.durationSec === 12.5, r1.durationSec);

  const tagged = await anon.feed({ hashtag: '#GOLAZO' }, null);
  expect('hashtag filter', tagged.items.length === 2, tagged.items.map((r) => r.caption));
  expect('hashtag filter keeps all tags on each reel', tagged.items.find((r) => r.caption === 'Golazo number 1')!.hashtags.length === 2);

  const byUser = await anon.feed({ username: 'skillzone' }, null);
  expect('creator filter', byUser.items.length === 10 && byUser.items.every((r) => r.userId === A));
  const nobody = await anon.feed({ username: 'naija_ballers' }, null);
  expect('creator with no reels -> empty', nobody.items.length === 0);

  expect('reel by id', (await anon.reel(r1.id))?.id === r1.id);
  expect('user by username', (await anon.userByUsername('Naija_Ballers'))?.fans === 0);
  expect('fan count from supports', (await anon.user(A))?.fans === 1);
  expect('me() signed out is null', (await anon.me()) === null);
  expect('me() signed in', (await b.me())?.username === 'naija_ballers');

  const tags = await anon.trendingHashtags();
  expect('trending hashtags', tags.length === 2 && tags[0].name === 'golazo' && tags[0].usageCount === 2, tags);
  expect('unknown hashtag -> zero', (await anon.hashtag('nothing')).usageCount === 0);

  const comments = await anon.comments(r1.id);
  expect('comments with author', comments.length === 1 && comments[0].author.username === 'naija_ballers' && comments[0].text === 'This is filthy', comments);

  expect('notifications empty when signed out', (await anon.notifications()).length === 0);
  const notes = await a.notifications();
  expect('A has notifications', notes.length >= 3, notes.length);
  expect('comment notification text', notes.some((n) => n.type === 'comment' && n.text === 'commented: "This is filthy"' && n.actor?.username === 'naija_ballers'), notes);
  expect('system notification text', notes.some((n) => n.type === 'system' && n.text === 'Welcome to GamePulse!' && n.actor === null));
  const bNotes = await b.notifications();
  expect('B sees only their own (welcome)', bNotes.length === 1 && bNotes[0].type === 'system', bNotes);

  const s = await b.search('golazo number 1');
  expect('search reels by caption', s.reels.some((r) => r.caption === 'Golazo number 1'), s.reels.length);
  const s2 = await b.search('@naija');
  expect('search excludes yourself', s2.users.length === 0, s2.users);
  const s3 = await a.search('naija');
  expect('search users', s3.users.length === 1);
  const s4 = await a.search('%,() weird');
  expect('search survives odd characters', Array.isArray(s4.users));
  expect('search by tag', (await a.search('#gola')).hashtags[0]?.name === 'golazo');

  // ---------------------------------------------------------------- writes
  const reel2 = p1.items[1];
  expect('viewer state: signed out sees nothing cheered', !reel2.viewer.cheered);
  await b.setCheer(reel2.id, true);
  await b.setCheer(reel2.id, true); // double tap is harmless
  let seen = await b.reel(reel2.id);
  expect('cheer saved and shown as mine', seen?.viewer.cheered === true && seen.cheers === 1, seen?.viewer);
  expect('another user does not see it as theirs', (await a.reel(reel2.id))?.viewer.cheered === false);
  await b.setCheer(reel2.id, false);
  seen = await b.reel(reel2.id);
  expect('uncheer removes it', seen?.viewer.cheered === false && seen.cheers === 0, seen);

  await b.setSave(reel2.id, true);
  await b.setReplay(reel2.id, true);
  seen = await b.reel(reel2.id);
  expect('save + replay shown as mine', !!seen?.viewer.saved && !!seen?.viewer.replayed && seen.replays === 1, seen?.viewer);

  const posted = await b.addComment(reel2.id, '  Top bins!  ');
  expect('comment posted with author and trimmed', posted.text === 'Top bins!' && posted.author.username === 'naija_ballers', posted);
  expect('comment appears in list', (await anon.comments(reel2.id)).some((c) => c.id === posted.id));
  let blank = false;
  await b.addComment(reel2.id, '   ').catch(() => (blank = true));
  expect('blank comment refused', blank);

  expect('B already supports A', (await b.mySupports()).includes(A));
  await b.setSupport(A, false);
  expect('unsupport', !(await b.mySupports()).includes(A) && (await anon.user(A))?.fans === 0);
  await b.setSupport(A, true);
  let selfErr = '';
  await a.setSupport(A, true).catch((e) => (selfErr = e.message));
  expect('cannot support yourself', selfErr.includes("can't support"), selfErr);

  expect('username taken for B', (await b.usernameAvailable('skillzone')) === false);
  expect('own username counts as available', (await a.usernameAvailable('skillzone')) === true);
  let taken = '';
  await b.updateProfile({ username: 'skillzone' }).catch((e) => (taken = e.message));
  expect('taken username gives a friendly error', taken.includes('taken'), taken);
  const updated = await b.updateProfile({ username: 'naija.ballers', displayName: 'Naija Ballers FC', onboarded: true });
  expect('profile updated', updated.username === 'naija.ballers' && updated.onboarded === true, updated);

  const before = (await a.notifications()).filter((n) => !n.read).length;
  expect('A got new notifications from B activity', before >= 3, before);
  expect('comment notification links the comment text', (await a.notifications()).some((n) => n.text === 'commented: "Top bins!"'));
  await a.markNotificationsRead();
  expect('mark all read', (await a.notifications()).every((n) => n.read));

  await b.report({ reelId: reel2.id, reason: 'spam', details: 'test' });
  expect('report accepted', true);
  let anonErr = '';
  await anon.setCheer(reel2.id, true).catch((e) => (anonErr = e.message));
  expect('signed-out write refused', anonErr === 'Sign in first.', anonErr);

  await anon.recordView(reel2.id);
  await anon.recordShare(reel2.id);
  seen = await anon.reel(reel2.id);
  expect('views and shares counted', seen?.views === 1 && seen.shares === 1, { v: seen?.views, s: seen?.shares });

  console.log(failures ? `\n${failures} FAILED` : '\nALL API CHECKS PASSED');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
