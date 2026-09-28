/**
 * Reads from Supabase. Row shapes follow supabase/migrations/*.sql; every row is mapped to the
 * app's domain types here so screens never see snake_case or database details.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  AppNotification,
  Comment,
  Hashtag,
  NotificationType,
  ProfilePatch,
  Reel,
  ReelStatus,
  User,
} from '../types';

import { FEED_PAGE_SIZE, normalizeHashtag, UserFacingError, type DataSource } from './source';

const PROFILE =
  'id, username, display_name, bio, avatar_url, country, country_flag, favorite_club, verified, onboarded, fans_count, supporting_count';

const REEL = `id, user_id, caption, status, playback_url, thumbnail_url, duration_sec,
  cheers_count, comments_count, replays_count, shares_count, views_count, created_at, published_at,
  creator:profiles!reels_user_id_fkey(${PROFILE}), tags:reel_hashtags(tag)`;

/** Signed-in only: the viewer's own cheer/save/replay rows, filtered to them in `reelQuery`. */
const VIEWER = `, my_cheers:cheers(user_id), my_saves:saves(user_id), my_replays:replays(user_id)`;

const COMMENT = `id, reel_id, user_id, parent_id, body, cheers_count, created_at,
  author:profiles!comments_user_id_fkey(${PROFILE})`;

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  country: string;
  country_flag: string;
  favorite_club: string;
  verified: boolean;
  onboarded: boolean;
  fans_count: number;
  supporting_count: number;
};

type ReelRow = {
  id: string;
  user_id: string;
  caption: string;
  status: ReelStatus;
  playback_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | string | null;
  cheers_count: number;
  comments_count: number;
  replays_count: number;
  shares_count: number;
  views_count: number;
  created_at: string;
  published_at: string | null;
  creator: ProfileRow;
  tags: { tag: string }[];
  my_cheers?: unknown[];
  my_saves?: unknown[];
  my_replays?: unknown[];
};

type CommentRow = {
  id: string;
  reel_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  cheers_count: number;
  created_at: string;
  author: ProfileRow;
};

type NotificationRow = {
  id: string;
  type: NotificationType;
  actor_id: string | null;
  reel_id: string | null;
  body: string | null;
  read: boolean;
  created_at: string;
  actor: ProfileRow | null;
  comment: { body: string } | null;
};

type HashtagRow = { name: string; usage_count: number; trending_score: number };

export const toUser = (p: ProfileRow): User => ({
  id: p.id,
  username: p.username,
  displayName: p.display_name || p.username,
  bio: p.bio,
  avatarUrl: p.avatar_url,
  country: p.country,
  countryFlag: p.country_flag,
  favoriteClub: p.favorite_club,
  verified: p.verified,
  onboarded: p.onboarded,
  fans: p.fans_count,
  supporting: p.supporting_count,
});

export const toReel = (r: ReelRow): Reel => ({
  id: r.id,
  userId: r.user_id,
  creator: toUser(r.creator),
  playbackUrl: r.playback_url ?? '',
  thumbnailUrl: r.thumbnail_url ?? '',
  caption: r.caption,
  hashtags: r.tags.map((t) => t.tag),
  durationSec: Number(r.duration_sec ?? 0),
  status: r.status,
  cheers: r.cheers_count,
  comments: r.comments_count,
  replays: r.replays_count,
  shares: r.shares_count,
  views: r.views_count,
  createdAt: r.published_at ?? r.created_at,
  viewer: {
    cheered: (r.my_cheers?.length ?? 0) > 0,
    saved: (r.my_saves?.length ?? 0) > 0,
    replayed: (r.my_replays?.length ?? 0) > 0,
  },
});

const toComment = (c: CommentRow): Comment => ({
  id: c.id,
  reelId: c.reel_id,
  userId: c.user_id,
  parentId: c.parent_id,
  text: c.body,
  cheers: c.cheers_count,
  createdAt: c.created_at,
  author: toUser(c.author),
});

const PROFILE_COLUMNS: Record<keyof ProfilePatch, string> = {
  username: 'username',
  displayName: 'display_name',
  bio: 'bio',
  country: 'country',
  countryFlag: 'country_flag',
  favoriteClub: 'favorite_club',
  onboarded: 'onboarded',
};

const toHashtag = (h: HashtagRow): Hashtag => ({
  name: h.name,
  usageCount: h.usage_count,
  trendingScore: h.trending_score,
});

const NOTIFICATION_TEXT: Record<Exclude<NotificationType, 'system' | 'comment'>, string> = {
  cheer: 'cheered your Moment',
  new_fan: 'became your Fan',
  mention: 'mentioned you in a Moment',
  replay: 'replayed your Moment',
};

function notificationText(n: NotificationRow) {
  if (n.type === 'system') return n.body ?? '';
  if (n.type === 'comment') {
    const body = n.comment?.body ?? n.body;
    return body ? `commented: "${body}"` : 'commented on your Moment';
  }
  return NOTIFICATION_TEXT[n.type];
}

/** Keep search input to characters that are safe inside PostgREST filter strings. */
const cleanQuery = (q: string) =>
  q
    .trim()
    .toLowerCase()
    .replace(/^[#@]/, '')
    .replace(/[^\p{L}\p{N}_. -]/gu, '')
    .slice(0, 50);

type Result<T> = { data: T | null; error: { message: string } | null };

/** Single row or null; throws on a request error. */
function check<T>(res: Result<T>): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** List of rows (never null); throws on a request error. */
function rowsOf<T>(res: Result<T[]>): T[] {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? [];
}

export function createSupabaseSource(
  client: SupabaseClient,
  currentUserId: () => Promise<string | null> = async () =>
    (await client.auth.getSession()).data.session?.user.id ?? null,
): DataSource {
  const profileById = async (id: string) =>
    check(await client.from('profiles').select(PROFILE).eq('id', id).maybeSingle<ProfileRow>());

  /** Reels with creator, tags and — when signed in — the viewer's own engagement. */
  const reelQuery = (uid: string | null, extra = '') => {
    let q = client.from('reels').select(REEL + (uid ? VIEWER : '') + extra);
    if (uid) q = q.eq('my_cheers.user_id', uid).eq('my_saves.user_id', uid).eq('my_replays.user_id', uid);
    return q;
  };

  const requireUser = async () => {
    const uid = await currentUserId();
    if (!uid) throw new UserFacingError('Sign in first.');
    return uid;
  };

  /** Insert a (user, target) row; a duplicate means it's already on, which is fine. */
  const insertEdge = async (table: string, row: Record<string, string>) => {
    const { error } = await client.from(table).insert(row);
    if (error && error.code !== '23505') throw new Error(error.message);
  };

  const deleteEdge = async (table: string, match: Record<string, string>) => {
    const { error } = await client.from(table).delete().match(match);
    if (error) throw new Error(error.message);
  };

  return {
    kind: 'supabase',

    async feed(filter, cursor) {
      let extra = '';
      if (filter.hashtag) extra += ', tagged:reel_hashtags!inner(tag)';
      if (filter.username) extra += ', owner:profiles!reels_user_id_fkey!inner(username)';

      let q = reelQuery(await currentUserId(), extra).eq('status', 'published');
      if (filter.hashtag) q = q.eq('tagged.tag', normalizeHashtag(filter.hashtag));
      if (filter.username) q = q.eq('owner.username', filter.username);
      if (cursor) q = q.lt('published_at', cursor);

      const rows = rowsOf(
        await q
          .order('published_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(FEED_PAGE_SIZE)
          .overrideTypes<ReelRow[], { merge: false }>(),
      );
      const items = rows.map(toReel);
      const last = rows[rows.length - 1];
      return {
        items,
        nextCursor: rows.length === FEED_PAGE_SIZE && last?.published_at ? last.published_at : null,
      };
    },

    async reel(id) {
      const row = check(await reelQuery(await currentUserId()).eq('id', id).maybeSingle<ReelRow>());
      return row ? toReel(row) : null;
    },

    async user(id) {
      const row = await profileById(id);
      return row ? toUser(row) : null;
    },

    async userByUsername(username) {
      const row = check(
        await client.from('profiles').select(PROFILE).eq('username', username.toLowerCase()).maybeSingle<ProfileRow>(),
      );
      return row ? toUser(row) : null;
    },

    async me() {
      const uid = await currentUserId();
      if (!uid) return null;
      const row = await profileById(uid);
      return row ? toUser(row) : null;
    },

    async trendingHashtags() {
      const rows = rowsOf(
        await client
          .from('hashtags')
          .select('name, usage_count, trending_score')
          .order('trending_score', { ascending: false })
          .order('usage_count', { ascending: false })
          .limit(20)
          .overrideTypes<HashtagRow[], { merge: false }>(),
      );
      return rows.map(toHashtag);
    },

    async hashtag(name) {
      const tag = normalizeHashtag(name);
      const row = check(
        await client
          .from('hashtags')
          .select('name, usage_count, trending_score')
          .eq('name', tag)
          .maybeSingle<HashtagRow>(),
      );
      return row ? toHashtag(row) : { name: tag, usageCount: 0, trendingScore: 0 };
    },

    async comments(reelId) {
      const rows = rowsOf(
        await client
          .from('comments')
          .select(COMMENT)
          .eq('reel_id', reelId)
          .order('created_at', { ascending: false })
          .limit(200)
          .overrideTypes<CommentRow[], { merge: false }>(),
      );
      return rows.map(toComment);
    },

    async notifications() {
      if (!(await currentUserId())) return [];
      const rows = rowsOf(
        await client
          .from('notifications')
          .select(`id, type, actor_id, reel_id, body, read, created_at,
            actor:profiles!notifications_actor_id_fkey(${PROFILE}), comment:comments(body)`)
          .order('created_at', { ascending: false })
          .limit(100)
          .overrideTypes<NotificationRow[], { merge: false }>(),
      );
      return rows.map(
        (n): AppNotification => ({
          id: n.id,
          type: n.type,
          actorId: n.actor_id,
          reelId: n.reel_id,
          text: notificationText(n),
          read: n.read,
          createdAt: n.created_at,
          actor: n.actor ? toUser(n.actor) : null,
        }),
      );
    },

    async search(query) {
      const q = cleanQuery(query);
      if (!q) return { users: [], hashtags: [], reels: [] };
      const like = `%${q}%`;
      const me = await currentUserId();

      const [users, tags, reels] = await Promise.all([
        client
          .from('profiles')
          .select(PROFILE)
          .or(`username.ilike.${like},display_name.ilike.${like}`)
          .order('fans_count', { ascending: false })
          .limit(20)
          .overrideTypes<ProfileRow[], { merge: false }>(),
        client
          .from('hashtags')
          .select('name, usage_count, trending_score')
          .ilike('name', like)
          .order('usage_count', { ascending: false })
          .limit(20)
          .overrideTypes<HashtagRow[], { merge: false }>(),
        reelQuery(me)
          .eq('status', 'published')
          .ilike('caption', like)
          .order('published_at', { ascending: false })
          .limit(30)
          .overrideTypes<ReelRow[], { merge: false }>(),
      ]);

      return {
        users: rowsOf(users)
          .filter((u) => u.id !== me)
          .map(toUser),
        hashtags: rowsOf(tags).map(toHashtag),
        reels: rowsOf(reels).map(toReel),
      };
    },

    async mySupports() {
      const uid = await currentUserId();
      if (!uid) return [];
      const rows = rowsOf(
        await client
          .from('supports')
          .select('creator_id')
          .eq('supporter_id', uid)
          .overrideTypes<{ creator_id: string }[], { merge: false }>(),
      );
      return rows.map((r) => r.creator_id);
    },

    async usernameAvailable(username) {
      const uid = await currentUserId();
      const row = check(
        await client.from('profiles').select('id').eq('username', username).maybeSingle<{ id: string }>(),
      );
      return !row || row.id === uid;
    },

    async setCheer(reelId, on) {
      const uid = await requireUser();
      if (on) await insertEdge('cheers', { reel_id: reelId });
      else await deleteEdge('cheers', { reel_id: reelId, user_id: uid });
    },

    async setSave(reelId, on) {
      const uid = await requireUser();
      if (on) await insertEdge('saves', { reel_id: reelId });
      else await deleteEdge('saves', { reel_id: reelId, user_id: uid });
    },

    async setReplay(reelId, on) {
      const uid = await requireUser();
      if (on) await insertEdge('replays', { reel_id: reelId });
      else await deleteEdge('replays', { reel_id: reelId, user_id: uid });
    },

    async setSupport(creatorId, on) {
      const uid = await requireUser();
      if (creatorId === uid) throw new UserFacingError("You can't support yourself.");
      if (on) await insertEdge('supports', { creator_id: creatorId });
      else await deleteEdge('supports', { creator_id: creatorId, supporter_id: uid });
    },

    async addComment(reelId, body, parentId = null) {
      await requireUser();
      const text = body.trim();
      if (!text) throw new UserFacingError('Write something first.');
      const { data: row, error } = await client
        .from('comments')
        .insert({ reel_id: reelId, body: text, parent_id: parentId })
        .select(COMMENT)
        .single<CommentRow>();
      if (error) throw new Error(error.message);
      return toComment(row);
    },

    async markNotificationsRead() {
      if (!(await currentUserId())) return;
      const { error } = await client.from('notifications').update({ read: true }).eq('read', false);
      if (error) throw new Error(error.message);
    },

    async report({ reelId, reason, details = '' }) {
      await requireUser();
      const { error } = await client.from('reports').insert({ reel_id: reelId, reason, details });
      if (error) throw new Error(error.message);
    },

    async updateProfile(patch) {
      const uid = await requireUser();
      const row: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) row[PROFILE_COLUMNS[k as keyof ProfilePatch]] = v;
      }
      const { data: updated, error } = await client
        .from('profiles')
        .update(row)
        .eq('id', uid)
        .select(PROFILE)
        .single<ProfileRow>();
      if (error?.code === '23505') throw new UserFacingError('That username is taken. Try another.');
      if (error?.code === '23514')
        throw new UserFacingError('Check your details: usernames are 3–24 lowercase letters, numbers, _ or .');
      if (error) throw new Error(error.message);
      return toUser(updated);
    },

    async recordView(reelId) {
      await client.rpc('record_view', { p_reel_id: reelId });
    },

    async recordShare(reelId) {
      await client.rpc('record_share', { p_reel_id: reelId });
    },
  };
}
