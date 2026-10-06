/**
 * Domain types used by screens. `*Record` types are the stored shape (one table row, ids only);
 * the un-suffixed types are what screens receive, with the people they reference embedded.
 */

export type User = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  country: string;
  countryFlag: string;
  favoriteClub: string;
  verified: boolean;
  fans: number;
  supporting: number;
  avatarUrl?: string | null;
  /** False until the user has picked a username, country and club. */
  onboarded?: boolean;
  /** All-time Pulse Points (decides the rank). */
  pulsePoints?: number;
  /** Days in a row they've opened GamePulse. */
  streakDays?: number;
  /** Weekly challenges won. */
  challengeWins?: number;
};

/** A weekly challenge: post a Moment with its hashtag while it runs. */
export type Challenge = {
  id: string;
  tag: string;
  title: string;
  description: string;
  emoji: string;
  startsAt: string;
  endsAt: string;
  entries: number;
  /** Set once the week is over and the winner has been crowned. */
  winner: User | null;
  winnerReelId: string | null;
  finished: boolean;
};

/** The reel a Moment responds to (a duet). */
export type ReplyTarget = { reelId: string; username: string };

/** One row of Top fans this week. */
export type FanStanding = { user: User; weekPoints: number; position: number };

/** One club in Club Wars this week. */
export type ClubStanding = { club: string; points: number; fans: number; position: number };

/** The signed-in user's week so far. Positions are null until they've earned something. */
export type MyWeek = { points: number; position: number | null; countryPosition: number | null };

/** Result of the daily check-in. `awarded` is 0 if they'd already checked in today. */
export type CheckIn = { awarded: number; streak: number; usedPass?: boolean };

/** Profile fields a user can change themselves. */
export type ProfilePatch = Partial<
  Pick<
    User,
    'username' | 'displayName' | 'bio' | 'country' | 'countryFlag' | 'favoriteClub' | 'onboarded' | 'avatarUrl'
  >
>;

/** A photo picked on the device, ready to upload. */
export type LocalImage = {
  uri: string;
  mimeType: string;
  /** Web only: the picked File. */
  file?: Blob;
};

export type ReelStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'published' | 'removed';

export type ReelRecord = {
  id: string;
  userId: string;
  playbackUrl: string;
  thumbnailUrl: string;
  caption: string;
  hashtags: string[];
  durationSec: number;
  status: ReelStatus;
  cheers: number;
  comments: number;
  replays: number;
  shares: number;
  views: number;
  createdAt: string;
};

/** What the signed-in viewer has already done to a reel (all false when signed out). */
export type ReelViewerState = { cheered: boolean; saved: boolean; replayed: boolean };

export type Reel = ReelRecord & {
  creator: User;
  viewer: ReelViewerState;
  /** Set when this Moment responds to another one. */
  replyTo?: ReplyTarget | null;
  /** How many published Moments respond to this one. */
  responses?: number;
};

export type CommentRecord = {
  id: string;
  reelId: string;
  userId: string;
  text: string;
  parentId: string | null;
  cheers: number;
  createdAt: string;
};

export type Comment = CommentRecord & { author: User };

export type Hashtag = {
  name: string;
  usageCount: number;
  trendingScore: number;
};

export type NotificationType = 'cheer' | 'comment' | 'new_fan' | 'mention' | 'replay' | 'response' | 'system';

export type NotificationRecord = {
  id: string;
  type: NotificationType;
  actorId: string | null;
  reelId: string | null;
  text: string;
  read: boolean;
  createdAt: string;
};

export type AppNotification = NotificationRecord & { actor: User | null };

/** One page of a paginated list. `nextCursor` is null on the last page. */
export type Page<T> = { items: T[]; nextCursor: string | null };
