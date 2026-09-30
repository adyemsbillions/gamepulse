/**
 * Bundled sample data behind the same async interface as Supabase, so screens are written once.
 * Used whenever EXPO_PUBLIC_SUPABASE_URL is not set.
 */
import * as mock from '../mock-data';
import type { Comment, Reel, ReelRecord, User } from '../types';

import { FEED_PAGE_SIZE, normalizeHashtag, type DataSource, type FeedFilter } from './source';

// Sample-mode engagement lives in memory for the session.
const mine = { cheers: new Set<string>(), saves: new Set<string>(), replays: new Set<string>(), supports: new Set(['u_2']) };

const usersById = new Map(mock.users.map((u) => [u.id, u]));
const withCreator = (r: ReelRecord): Reel => ({
  ...r,
  creator: usersById.get(r.userId)!,
  viewer: { cheered: mine.cheers.has(r.id), saved: mine.saves.has(r.id), replayed: mine.replays.has(r.id) },
});
const toggle = (set: Set<string>, id: string, on: boolean) => void (on ? set.add(id) : set.delete(id));

function score(r: ReelRecord) {
  const ageHours = (Date.now() - Date.parse(r.createdAt)) / 36e5;
  const engagement = (r.cheers + r.comments * 3 + r.replays * 4 + r.shares * 4) / Math.max(r.views, 1);
  return engagement * 100 - ageHours * 0.5;
}

function filterFeed(filter: FeedFilter): ReelRecord[] {
  let list = mock.reels.filter((r) => r.status === 'published');
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
      .filter((c) => c.reelId === reelId)
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
    if (!q) return { users: [], hashtags: [], reels: [] };
    return {
      users: mock.users.filter(
        (u: User) =>
          u.id !== mock.CURRENT_USER_ID && (u.username.includes(q) || u.displayName.toLowerCase().includes(q)),
      ),
      hashtags: mock.hashtags.filter((h) => h.name.includes(q)),
      reels: filterFeed({})
        .filter((r) => r.caption.toLowerCase().includes(q) || r.hashtags.some((h) => h.includes(q)))
        .map(withCreator),
    };
  },

  async mySupports() {
    return [...mine.supports];
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

  async recordView() {},
  async recordShare() {},

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
