import type { AppNotification, Comment, Hashtag, Page, ProfilePatch, Reel, User } from '../types';

export type FeedFilter = { hashtag?: string; username?: string };

export type SearchResults = { users: User[]; hashtags: Hashtag[]; reels: Reel[] };

/**
 * Everything the app reads. Two implementations: `mock-source` (bundled sample data, used when
 * no Supabase project is configured) and `supabase-source` (the real backend).
 */
export interface DataSource {
  readonly kind: 'mock' | 'supabase';

  /** Published reels, newest first (creator feeds) or ranked (main feed). */
  feed(filter: FeedFilter, cursor: string | null): Promise<Page<Reel>>;
  reel(id: string): Promise<Reel | null>;

  user(id: string): Promise<User | null>;
  userByUsername(username: string): Promise<User | null>;
  /** The signed-in user's profile, or null when signed out. */
  me(): Promise<User | null>;

  trendingHashtags(): Promise<Hashtag[]>;
  hashtag(name: string): Promise<Hashtag>;

  comments(reelId: string): Promise<Comment[]>;
  notifications(): Promise<AppNotification[]>;
  search(query: string): Promise<SearchResults>;
  /** Ids of the creators the signed-in user supports. */
  mySupports(): Promise<string[]>;
  usernameAvailable(username: string): Promise<boolean>;

  // ---- writes (all require a signed-in user) ----
  setCheer(reelId: string, on: boolean): Promise<void>;
  setSave(reelId: string, on: boolean): Promise<void>;
  setReplay(reelId: string, on: boolean): Promise<void>;
  setSupport(creatorId: string, on: boolean): Promise<void>;
  addComment(reelId: string, body: string, parentId?: string | null): Promise<Comment>;
  markNotificationsRead(): Promise<void>;
  report(input: { reelId: string; reason: ReportReason; details?: string }): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<User>;
  recordView(reelId: string): Promise<void>;
  recordShare(reelId: string): Promise<void>;
}

export type ReportReason = 'spam' | 'abuse' | 'violence' | 'nudity' | 'hate' | 'copyright' | 'other';

/** A write the database refused for a reason the user can fix (shown as-is). */
export class UserFacingError extends Error {}

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,24}$/;

export const FEED_PAGE_SIZE = 10;

export function normalizeHashtag(tag: string) {
  return tag.replace(/^#/, '').toLowerCase();
}
