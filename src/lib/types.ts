/** Domain types — shaped after the plan's core data model so they map onto Supabase tables later. */

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
};

export type ReelStatus = 'uploading' | 'processing' | 'ready' | 'published' | 'removed';

export type Reel = {
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

export type Comment = {
  id: string;
  reelId: string;
  userId: string;
  text: string;
  parentId: string | null;
  cheers: number;
  createdAt: string;
};

export type Hashtag = {
  name: string;
  usageCount: number;
  trendingScore: number;
};

export type NotificationType = 'cheer' | 'comment' | 'new_fan' | 'mention' | 'replay' | 'system';

export type AppNotification = {
  id: string;
  type: NotificationType;
  actorId: string | null;
  reelId: string | null;
  text: string;
  read: boolean;
  createdAt: string;
};
