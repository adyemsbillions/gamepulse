import type {
  AppNotification,
  Challenge,
  CheckIn,
  ClubStanding,
  Comment,
  FanStanding,
  MyWeek,
  Hashtag,
  LocalImage,
  Page,
  ProfilePatch,
  Reel,
  ReelStatus,
  User,
} from '../types';

/**
 * Which reels a feed shows. `club`: reels by fans of that club. `saved`: the signed-in user's
 * saved reels, most recently saved first. With no filter it's Hot Now (ranked). `sort` applies to
 * hashtag feeds: 'hot' for Top, 'latest' (default) for newest first.
 */
export type FeedFilter = {
  hashtag?: string;
  username?: string;
  club?: string;
  saved?: boolean;
  sort?: 'hot' | 'latest';
  /** A challenge's entries, most Cheers first. */
  challenge?: string;
  /** Moments responding to this reel, newest first. */
  respondsTo?: string;
};

/** True when a feed is ranked by the hot score (Hot Now, or a hashtag's Top). */
export const isRankedFeed = (f: FeedFilter) =>
  !f.saved && !f.username && !f.club && !f.challenge && !f.respondsTo && (!f.hashtag || f.sort === 'hot');

export type SearchResults = { users: User[]; hashtags: Hashtag[]; clubs: string[]; reels: Reel[] };

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
  /** GameMakers whose favourite club is `club`, most Fans first. */
  clubFans(club: string): Promise<User[]>;
  /** Ids of the creators the signed-in user supports. */
  mySupports(): Promise<string[]>;
  /** Who the signed-in user has blocked and muted (empty when signed out). */
  myRelations(): Promise<Relations>;
  /** Profiles the signed-in user has blocked, most recent first. */
  blockedUsers(): Promise<User[]>;
  usernameAvailable(username: string): Promise<boolean>;

  // ---- writes (all require a signed-in user) ----
  setCheer(reelId: string, on: boolean): Promise<void>;
  setSave(reelId: string, on: boolean): Promise<void>;
  setReplay(reelId: string, on: boolean): Promise<void>;
  setSupport(creatorId: string, on: boolean): Promise<void>;
  /** Block: neither of you sees the other's Moments or comments, and any Support between you ends. */
  setBlock(userId: string, on: boolean): Promise<void>;
  /** Mute: their Moments stop showing in your Hot Now feed. Private; they aren't told. */
  setMute(userId: string, on: boolean): Promise<void>;
  /** Not interested: this reel leaves your Hot Now and its creator ranks lower for you. */
  notInterested(reelId: string): Promise<void>;
  addComment(reelId: string, body: string, parentId?: string | null): Promise<Comment>;
  markNotificationsRead(): Promise<void>;
  report(input: { reelId: string; reason: ReportReason; details?: string }): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<User>;
  /** Upload a new profile photo and make it the signed-in user's avatar. */
  uploadAvatar(image: LocalImage): Promise<User>;
  /** Permanently delete the signed-in user's account, Moments, videos, photos and activity. */
  deleteAccount(): Promise<void>;
  recordView(reelId: string): Promise<void>;
  recordShare(reelId: string): Promise<void>;

  // ---- Pulse Rank and Club Wars
  /** Daily check-in: keeps the streak going and gives today's points. Null when signed out. */
  checkIn(): Promise<CheckIn | null>;
  /** Top fans by points earned this week; `country` narrows it to one country. */
  topFans(country: string | null): Promise<FanStanding[]>;
  /** The signed-in user's points and positions this week (null when signed out). */
  myWeek(): Promise<MyWeek | null>;
  /** Clubs ranked by the points their fans earned this week. */
  clubWars(): Promise<ClubStanding[]>;

  // ---- weekly challenges and duets
  /** The challenge running now, and the one before it (with its winner once crowned). */
  challenges(): Promise<{ current: Challenge | null; previous: Challenge | null }>;
  challenge(id: string): Promise<Challenge | null>;
  /** Mark a new reel as a response to another (call right after startUpload). */
  linkResponse(reelId: string, replyTo: string): Promise<void>;

  // ---- push notifications (GP-017)
  /** Send the signed-in user's notifications to this device. Moves the token over if another account had it. */
  registerPushToken(token: string, platform: 'android' | 'ios'): Promise<void>;
  /** Stop sending to this device (on sign-out). */
  unregisterPushToken(token: string): Promise<void>;

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

export type Relations = { blocked: string[]; muted: string[] };

export type ReportReason = 'spam' | 'abuse' | 'violence' | 'nudity' | 'hate' | 'copyright' | 'other';

/** A write the database refused for a reason the user can fix (shown as-is). */
export class UserFacingError extends Error {}

export const USERNAME_PATTERN = /^[a-z0-9_.]{3,24}$/;

export const FEED_PAGE_SIZE = 10;

export function normalizeHashtag(tag: string) {
  return tag.replace(/^#/, '').toLowerCase();
}

/** Same limit as the `avatars` storage bucket. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Case-insensitive club match; most-used spelling of each club first. */
export function rankClubs(names: readonly string[], limit = 8): string[] {
  const byKey = new Map<string, { name: string; count: number }>();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const entry = byKey.get(key);
    if (entry) entry.count += 1;
    else byKey.set(key, { name, count: 1 });
  }
  return [...byKey.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((e) => e.name);
}

export const MAX_MOMENT_SECONDS = 60;
export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024;
export const MAX_HASHTAGS = 10;

/** #tags in a caption, lowercased and de-duplicated, in the order they appear. */
export function extractHashtags(caption: string): string[] {
  const tags = [...caption.matchAll(/#([A-Za-z0-9_]{1,50})/g)].map((m) => normalizeHashtag(m[1]));
  return [...new Set(tags)].slice(0, MAX_HASHTAGS);
}
