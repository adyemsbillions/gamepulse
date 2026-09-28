/**
 * Data access seam. Everything the UI reads goes through here so the mock data can be swapped
 * for Supabase queries without touching screens.
 */
import * as mock from './mock-data';
import type { Reel, User } from './types';

export const CURRENT_USER_ID = mock.CURRENT_USER_ID;

const usersById = new Map(mock.users.map((u) => [u.id, u]));

export function getUser(id: string): User | undefined {
  return usersById.get(id);
}

export function getUserByUsername(username: string): User | undefined {
  return mock.users.find((u) => u.username === username);
}

export function getCurrentUser(): User {
  return usersById.get(CURRENT_USER_ID)!;
}

export function getReel(id: string): Reel | undefined {
  return mock.reels.find((r) => r.id === id);
}

export type FeedFilter = { hashtag?: string; username?: string };

/** GameFeed ranking: v1 is recency + engagement, per the plan's "start simple" guidance. */
export function getFeed(filter: FeedFilter = {}): Reel[] {
  let list = mock.reels.filter((r) => r.status === 'published');
  if (filter.hashtag) {
    const tag = normalizeHashtag(filter.hashtag);
    list = list.filter((r) => r.hashtags.includes(tag));
  }
  if (filter.username) {
    const user = getUserByUsername(filter.username);
    list = user ? list.filter((r) => r.userId === user.id) : [];
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return list.sort((a, b) => score(b) - score(a));
}

function score(r: Reel) {
  const ageHours = (Date.now() - Date.parse(r.createdAt)) / 36e5;
  const engagement = (r.cheers + r.comments * 3 + r.replays * 4 + r.shares * 4) / Math.max(r.views, 1);
  return engagement * 100 - ageHours * 0.5;
}

export function getTrendingHashtags() {
  return [...mock.hashtags].sort((a, b) => b.trendingScore - a.trendingScore);
}

export function getHashtag(name: string) {
  const tag = normalizeHashtag(name);
  return mock.hashtags.find((h) => h.name === tag) ?? { name: tag, usageCount: 0, trendingScore: 0 };
}

export function getClubs() {
  return mock.clubs;
}

export function getComments(reelId: string) {
  return mock.comments.filter((c) => c.reelId === reelId);
}

export function getNotifications() {
  return mock.notifications;
}

export function search(query: string) {
  const q = query.trim().toLowerCase().replace(/^[#@]/, '');
  if (!q) return { users: [], hashtags: [], reels: [] };
  return {
    users: mock.users.filter(
      (u) => u.id !== CURRENT_USER_ID && (u.username.includes(q) || u.displayName.toLowerCase().includes(q)),
    ),
    hashtags: mock.hashtags.filter((h) => h.name.includes(q)),
    reels: getFeed().filter(
      (r) => r.caption.toLowerCase().includes(q) || r.hashtags.some((h) => h.includes(q)),
    ),
  };
}

export function normalizeHashtag(tag: string) {
  return tag.replace(/^#/, '').toLowerCase();
}
