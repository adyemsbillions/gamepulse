/**
 * Bundled sample data behind the same async interface as Supabase, so screens are written once.
 * Used whenever EXPO_PUBLIC_SUPABASE_URL is not set.
 */
import * as mock from '../mock-data';
import { weekEndsAt } from '../pulse';
import type { Challenge, Comment, Reel, ReelRecord, User } from '../types';

import { FEED_PAGE_SIZE, normalizeHashtag, rankClubs, type DataSource, type FeedFilter } from './source';

const sameClub = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const mockPulse = { checkedIn: '', streak: 2 };
const mockReplies = new Map<string, string>();

/** A challenge that's always running in sample mode, ending next Monday. */
function mockChallenge(): Challenge {
  const ends = weekEndsAt();
  return {
    id: 'ch_panna',
    tag: 'skills',
    title: 'Panna Challenge',
    description: 'Nutmeg someone. Clean, cheeky, on camera.',
    emoji: '🥜',
    startsAt: new Date(ends - 7 * 86_400_000).toISOString(),
    endsAt: new Date(ends).toISOString(),
    entries: mock.reels.filter((r) => r.hashtags.includes('skills')).length,
    winner: null,
    winnerReelId: null,
    finished: false,
  };
}
const weekPointsFor = (u: User) => 15 + ((u.fans * 7 + u.username.length * 13) % 240);

// Sample-mode engagement lives in memory for the session.
const mine = {
  cheers: new Set<string>(),
  saves: new Set<string>(),
  replays: new Set<string>(),
  supports: new Set(['u_2']),
  blocked: new Set<string>(),
  muted: new Set<string>(),
  hidden: new Set<string>(),
};

const usersById = new Map(mock.users.map((u) => [u.id, u]));
const withCreator = (r: ReelRecord): Reel => {
  const replyTo = mockReplies.get(r.id);
  const original = replyTo ? mock.reels.find((x) => x.id === replyTo) : undefined;
  return {
    ...r,
    creator: usersById.get(r.userId)!,
    viewer: { cheered: mine.cheers.has(r.id), saved: mine.saves.has(r.id), replayed: mine.replays.has(r.id) },
    replyTo: original ? { reelId: original.id, username: usersById.get(original.userId)?.username ?? '' } : null,
    responses: [...mockReplies.values()].filter((id) => id === r.id).length,
  };
};
const toggle = (set: Set<string>, id: string, on: boolean) => void (on ? set.add(id) : set.delete(id));

function score(r: ReelRecord) {
  const ageHours = (Date.now() - Date.parse(r.createdAt)) / 36e5;
  const engagement = (r.cheers + r.comments * 3 + r.replays * 4 + r.shares * 4) / Math.max(r.views, 1);
  return engagement * 100 - ageHours * 0.5;
}

function filterFeed(filter: FeedFilter): ReelRecord[] {
  let list = mock.reels.filter((r) => r.status === 'published' && !mine.blocked.has(r.userId));
  if (filter.saved) return list.filter((r) => mine.saves.has(r.id));
  if (filter.respondsTo) return list.filter((r) => mockReplies.get(r.id) === filter.respondsTo);
  if (filter.challenge) {
    const tag = mockChallenge().tag;
    return list.filter((r) => r.hashtags.includes(tag)).sort((a, b) => b.cheers - a.cheers);
  }
  if (!filter.hashtag && !filter.username && !filter.club)
    list = list.filter((r) => !mine.muted.has(r.userId) && !mine.hidden.has(r.id));
  if (filter.club) {
    const club = filter.club;
    list = list.filter((r) => sameClub(usersById.get(r.userId)?.favoriteClub ?? '', club));
  }
  if (filter.hashtag) {
    const tag = normalizeHashtag(filter.hashtag);
    list = list.filter((r) => r.hashtags.includes(tag));
  }
  if (filter.username) {
    const user = mock.users.find((u) => u.username === filter.username);
    return (user ? list.filter((r) => r.userId === user.id) : []).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
  if (filter.hashtag && filter.sort !== 'hot') return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return list.sort((a, b) => score(b) - score(a));
}

export const mockSource: DataSource = {
  kind: 'mock',

  async feed(filter, cursor) {
    const all = filterFeed(filter);
    const start = cursor ? Number(cursor) : 0;
    const items = all.slice(start, start + FEED_PAGE_SIZE).map(withCreator);
    const next = start + FEED_PAGE_SIZE;
    return { items, nextCursor: next < all.length ? String(next) : null };
  },

  async reel(id) {
    const r = mock.reels.find((x) => x.id === id);
    return r ? withCreator(r) : null;
  },

  async user(id) {
    return usersById.get(id) ?? null;
  },

  async userByUsername(username) {
    return mock.users.find((u) => u.username === username) ?? null;
  },

  async me() {
    return usersById.get(mock.CURRENT_USER_ID) ?? null;
  },

  async trendingHashtags() {
    return [...mock.hashtags].sort((a, b) => b.trendingScore - a.trendingScore);
  },

  async hashtag(name) {
    const tag = normalizeHashtag(name);
    return mock.hashtags.find((h) => h.name === tag) ?? { name: tag, usageCount: 0, trendingScore: 0 };
  },

  async comments(reelId) {
    return mock.comments
      .filter((c) => c.reelId === reelId && !mine.blocked.has(c.userId))
      .map((c): Comment => ({ ...c, author: usersById.get(c.userId)! }));
  },

  async notifications() {
    return mock.notifications.map((n) => ({
      ...n,
      actor: n.actorId ? (usersById.get(n.actorId) ?? null) : null,
    }));
  },

  async search(query) {
    const q = query.trim().toLowerCase().replace(/^[#@]/, '');
    if (!q) return { users: [], hashtags: [], clubs: [], reels: [] };
    return {
      users: mock.users.filter(
        (u: User) =>
          u.id !== mock.CURRENT_USER_ID && (u.username.includes(q) || u.displayName.toLowerCase().includes(q)),
      ),
      hashtags: mock.hashtags.filter((h) => h.name.includes(q)),
      clubs: rankClubs(
        [...mock.users.map((u) => u.favoriteClub), ...mock.clubs].filter((c) => c.toLowerCase().includes(q)),
      ),
      reels: filterFeed({})
        .filter((r) => r.caption.toLowerCase().includes(q) || r.hashtags.some((h) => h.includes(q)))
        .map(withCreator),
    };
  },

  async clubFans(club) {
    return mock.users.filter((u) => sameClub(u.favoriteClub, club)).sort((a, b) => b.fans - a.fans);
  },

  async mySupports() {
    return [...mine.supports];
  },

  async myRelations() {
    return { blocked: [...mine.blocked], muted: [...mine.muted] };
  },

  async blockedUsers() {
    return [...mine.blocked].flatMap((id) => usersById.get(id) ?? []);
  },

  async setBlock(userId, on) {
    toggle(mine.blocked, userId, on);
    if (on) mine.supports.delete(userId);
  },

  async setMute(userId, on) {
    toggle(mine.muted, userId, on);
  },

  async notInterested(reelId) {
    mine.hidden.add(reelId);
  },

  async usernameAvailable(username) {
    return !mock.users.some((u) => u.username === username && u.id !== mock.CURRENT_USER_ID);
  },

  async setCheer(reelId, on) {
    const reel = mock.reels.find((r) => r.id === reelId);
    if (reel && mine.cheers.has(reelId) !== on) reel.cheers += on ? 1 : -1;
    toggle(mine.cheers, reelId, on);
  },
  async setSave(reelId, on) {
    toggle(mine.saves, reelId, on);
  },
  async setReplay(reelId, on) {
    const reel = mock.reels.find((r) => r.id === reelId);
    if (reel && mine.replays.has(reelId) !== on) reel.replays += on ? 1 : -1;
    toggle(mine.replays, reelId, on);
  },
  async setSupport(creatorId, on) {
    toggle(mine.supports, creatorId, on);
  },

  async addComment(reelId, body, parentId = null) {
    const record = {
      id: `local_${Date.now()}`,
      reelId,
      userId: mock.CURRENT_USER_ID,
      text: body,
      parentId,
      cheers: 0,
      createdAt: new Date().toISOString(),
    };
    mock.comments.unshift(record);
    const reel = mock.reels.find((r) => r.id === reelId);
    if (reel) reel.comments += 1;
    return { ...record, author: usersById.get(mock.CURRENT_USER_ID)! };
  },

  async markNotificationsRead() {
    mock.notifications.forEach((n) => (n.read = true));
  },

  async report() {},

  async updateProfile(patch) {
    const me = usersById.get(mock.CURRENT_USER_ID)!;
    Object.assign(me, patch);
    return me;
  },

  // Sample mode: made-up but stable weekly numbers from the sample users.
  async checkIn() {
    const today = new Date().toDateString();
    if (mockPulse.checkedIn === today) return { awarded: 0, streak: mockPulse.streak };
    mockPulse.checkedIn = today;
    mockPulse.streak += 1;
    return { awarded: 5 + Math.min(mockPulse.streak - 1, 10), streak: mockPulse.streak };
  },

  async topFans(country) {
    return mock.users
      .filter((u) => !country || u.country === country)
      .map((u) => ({ user: u, weekPoints: weekPointsFor(u) }))
      .sort((a, b) => b.weekPoints - a.weekPoints)
      .map((row, i) => ({ ...row, position: i + 1 }));
  },

  async myWeek() {
    const me = usersById.get(mock.CURRENT_USER_ID)!;
    const fans = await mockSource.topFans(null);
    const local = await mockSource.topFans(me.country);
    return {
      points: weekPointsFor(me),
      position: fans.find((f) => f.user.id === me.id)?.position ?? null,
      countryPosition: local.find((f) => f.user.id === me.id)?.position ?? null,
    };
  },

  async clubWars() {
    const clubs = new Map<string, { club: string; points: number; fans: number }>();
    for (const u of mock.users) {
      const key = u.favoriteClub.toLowerCase();
      const entry = clubs.get(key) ?? { club: u.favoriteClub, points: 0, fans: 0 };
      entry.points += weekPointsFor(u);
      entry.fans += 1;
      clubs.set(key, entry);
    }
    return [...clubs.values()].sort((a, b) => b.points - a.points).map((c, i) => ({ ...c, position: i + 1 }));
  },

  async challenges() {
    return { current: mockChallenge(), previous: null };
  },

  async challenge(id) {
    return id === mockChallenge().id ? mockChallenge() : null;
  },

  async linkResponse(reelId, replyTo) {
    mockReplies.set(reelId, replyTo);
  },

  // Sample mode has no real account to delete.
  async deleteAccount() {},

  // Sample mode: the photo stays on this device.
  async uploadAvatar(image) {
    const me = usersById.get(mock.CURRENT_USER_ID)!;
    me.avatarUrl = image.uri;
    return { ...me };
  },

  async recordView() {},
  async recordShare() {},

  // Sample mode has no server to push from.
  async registerPushToken() {},
  async unregisterPushToken() {},

  // Sample mode: the "upload" stays on this device and plays the local file.
  async startUpload(input) {
    const reel: ReelRecord = {
      id: `local_${Date.now()}`,
      userId: mock.CURRENT_USER_ID,
      playbackUrl: input.localUri ?? '',
      thumbnailUrl: '',
      caption: input.caption,
      hashtags: input.tags,
      durationSec: input.durationSec ?? 0,
      status: 'processing',
      cheers: 0,
      comments: 0,
      replays: 0,
      shares: 0,
      views: 0,
      createdAt: new Date().toISOString(),
    };
    mock.reels.unshift(reel);
    return { reelId: reel.id, upload: null };
  },

  async uploadStatus(reelId) {
    const reel = mock.reels.find((r) => r.id === reelId);
    if (!reel) return 'failed';
    if (reel.status === 'processing') reel.status = 'published';
    return reel.status;
  },

  async deleteReel(reelId) {
    const i = mock.reels.findIndex((r) => r.id === reelId && r.userId === mock.CURRENT_USER_ID);
    if (i >= 0) mock.reels.splice(i, 1);
  },
};
