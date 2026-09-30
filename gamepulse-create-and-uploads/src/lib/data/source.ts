import type { AppNotification, Comment, Hashtag, Page, ProfilePatch, Reel, ReelStatus, User } from '../types';

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

  // ---- uploads (GP-019/021/022)
  /** Create a reel for a new video and get where to upload it. */
  startUpload(input: UploadRequest): Promise<UploadTicket>;
  /** Where a new reel's video is up to (asks the video host, so it works without the webhook). */
  uploadStatus(reelId: string): Promise<ReelStatus>;
  /** Delete one of your own reels and its video. */
  deleteReel(reelId: string): Promise<void>;
}

export type UploadRequest = {
  caption: string;
  tags: string[];
  durationSec: number | null;
  fileType: string;
  fileSize: number | null;
  /** On-device file. Only sample mode uses it (it plays the local file instead of uploading). */
  localUri?: string;
};

/** A signed TUS upload straight to the video host. `upload` is null in sample mode. */
export type UploadTicket = {
  reelId: string;
  upload: {
    endpoint: string;
    headers: Record<string, string>;
    metadata: Record<string, string>;
  } | null;
};

export type ReportReason = 'spam' | 'abuse' | 'violence' | 'nudity' | 'hate' | 'copyright' | 'other';

/** A write the database refused for a reason the user can fix (shown as-is). */
export class UserFacingError extends Error {}

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,24}$/;

export const FEED_PAGE_SIZE = 10;

export function normalizeHashtag(tag: string) {
  return tag.replace(/^#/, '').toLowerCase();
}

export const MAX_MOMENT_SECONDS = 60;
export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;
export const MAX_HASHTAGS = 10;

/** #tags in a caption, lowercased and de-duplicated, in the order they appear. */
export function extractHashtags(caption: string): string[] {
  const tags = [...caption.matchAll(/#([A-Za-z0-9_]{1,50})/g)].map((m) => normalizeHashtag(m[1]));
  return [...new Set(tags)].slice(0, MAX_HASHTAGS);
}
