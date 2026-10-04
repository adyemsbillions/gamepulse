/**
 * Reads from Supabase. Row shapes follow supabase/migrations/*.sql; every row is mapped to the
 * app's domain types here so screens never see snake_case or database details.
 */
import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

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

import {
  FEED_PAGE_SIZE,
  normalizeHashtag,
  rankClubs,
  UserFacingError,
  type DataSource,
  type UploadTicket,
} from './source';

import { CLUB_SUGGESTIONS } from '@/constants/places';

/** Public bucket; each user may only write inside a folder named after their id. */
const AVATAR_BUCKET = 'avatars';

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
  avatarUrl: 'avatar_url',
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

/**
 * A club name as an exact, case-insensitive `ilike` pattern: `%` and `_` escaped, and `*`
 * (PostgREST's own wildcard) dropped.
 */
const clubPattern = (club: string) =>
  club
    .trim()
    .slice(0, 40)
    .replace(/\*/g, '')
    .replace(/[\\%_]/g, '\\$&');

type Result<T> = { data: T | null; error: { message: string } | null };

/** Single row or null; throws on a request error. */
function check<T>(res: Result<T>): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** A refused write. Rate limits (SQLSTATE GP429, see rate_limits.sql) carry a message for users. */
function writeError(error: { code?: string; message: string }) {
  return error.code === 'GP429' ? new UserFacingError(error.message) : new Error(error.message);
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
    if (error && error.code !== '23505') throw writeError(error);
  };

  /** Call the `videos` Edge Function. Its error messages are written for users. */
  const videos = async <T>(body: Record<string, unknown>): Promise<T> => {
    const { data: result, error } = await client.functions.invoke<T>('videos', { body });
    if (error instanceof FunctionsHttpError) {
      const payload = await (error.context as Response).json().catch(() => null);
      throw new UserFacingError(payload?.error ?? 'Something went wrong. Try again.');
    }
    if (error) throw new Error(error.message);
    return result as T;
  };

  const deleteEdge = async (table: string, match: Record<string, string>) => {
    const { error } = await client.from(table).delete().match(match);
    if (error) throw new Error(error.message);
  };

  /** Saved reels page by when they were saved, so the cursor is the save time. */
  const savedFeed = async (uid: string | null, cursor: string | null) => {
    if (!uid) return { items: [], nextCursor: null };
    let q = client.from('saves').select('reel_id, created_at').eq('user_id', uid);
    if (cursor) q = q.lt('created_at', cursor);
    const saves = rowsOf(
      await q
        .order('created_at', { ascending: false })
        .limit(FEED_PAGE_SIZE)
        .overrideTypes<{ reel_id: string; created_at: string }[], { merge: false }>(),
    );
    if (saves.length === 0) return { items: [], nextCursor: null };

    const rows = rowsOf(
      await reelQuery(uid)
        .in(
          'id',
          saves.map((s) => s.reel_id),
        )
        .eq('status', 'published')
        .overrideTypes<ReelRow[], { merge: false }>(),
    );
    const byId = new Map(rows.map((r) => [r.id, toReel(r)]));
    return {
      // A saved reel that was since removed simply drops out.
      items: saves.map((s) => byId.get(s.reel_id)).filter((r): r is Reel => !!r),
      nextCursor: saves.length === FEED_PAGE_SIZE ? saves[saves.length - 1].created_at : null,
    };
  };

  const mutedIds = async (uid: string) =>
    rowsOf(
      await client
        .from('mutes')
        .select('muted_id')
        .eq('muter_id', uid)
        .overrideTypes<{ muted_id: string }[], { merge: false }>(),
    ).map((r) => r.muted_id);

  const updateProfile: DataSource['updateProfile'] = async (patch) => {
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
  };

  return {
    kind: 'supabase',

    async feed(filter, cursor) {
      const uid = await currentUserId();
      if (filter.saved) return savedFeed(uid, cursor);
      // The main feed leaves out people you muted. (Blocked people's reels are hidden by the database.)
      const isMainFeed = !filter.hashtag && !filter.username && !filter.club;
      // If the mute list can't be read, show the feed unfiltered rather than not at all.
      const muted = isMainFeed && uid ? await mutedIds(uid).catch(() => []) : [];

      const ownerColumns = [filter.username && 'username', filter.club && 'favorite_club'].filter(Boolean);
      let extra = '';
      if (filter.hashtag) extra += ', tagged:reel_hashtags!inner(tag)';
      if (ownerColumns.length) extra += `, owner:profiles!reels_user_id_fkey!inner(${ownerColumns.join(', ')})`;

      let q = reelQuery(uid, extra).eq('status', 'published');
      if (filter.hashtag) q = q.eq('tagged.tag', normalizeHashtag(filter.hashtag));
      if (filter.username) q = q.eq('owner.username', filter.username);
      if (filter.club) q = q.ilike('owner.favorite_club', clubPattern(filter.club));
      if (muted.length) q = q.not('user_id', 'in', `(${muted.join(',')})`);
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
      if (!q) return { users: [], hashtags: [], clubs: [], reels: [] };
      const like = `%${q}%`;
      const me = await currentUserId();

      const [users, tags, clubs, reels] = await Promise.all([
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
        // Clubs aren't a table yet: they're whatever fans typed as their favourite club.
        client
          .from('profiles')
          .select('favorite_club')
          .ilike('favorite_club', like)
          .limit(200)
          .overrideTypes<{ favorite_club: string }[], { merge: false }>(),
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
        clubs: rankClubs([
          ...rowsOf(clubs).map((c) => c.favorite_club),
          ...CLUB_SUGGESTIONS.filter((c) => c.toLowerCase().includes(q)),
        ]),
        reels: rowsOf(reels).map(toReel),
      };
    },

    async clubFans(club) {
      const rows = rowsOf(
        await client
          .from('profiles')
          .select(PROFILE)
          .ilike('favorite_club', clubPattern(club))
          .eq('onboarded', true)
          .order('fans_count', { ascending: false })
          .limit(30)
          .overrideTypes<ProfileRow[], { merge: false }>(),
      );
      return rows.map(toUser);
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

    async myRelations() {
      const uid = await currentUserId();
      if (!uid) return { blocked: [], muted: [] };
      const [blocked, muted] = await Promise.all([
        client
          .from('blocks')
          .select('blocked_id')
          .eq('blocker_id', uid)
          .overrideTypes<{ blocked_id: string }[], { merge: false }>(),
        mutedIds(uid),
      ]);
      return { blocked: rowsOf(blocked).map((r) => r.blocked_id), muted };
    },

    async blockedUsers() {
      const uid = await currentUserId();
      if (!uid) return [];
      const rows = rowsOf(
        await client
          .from('blocks')
          .select(`created_at, blocked:profiles!blocks_blocked_id_fkey(${PROFILE})`)
          .eq('blocker_id', uid)
          .order('created_at', { ascending: false })
          .overrideTypes<{ blocked: ProfileRow | null }[], { merge: false }>(),
      );
      return rows.flatMap((r) => (r.blocked ? [toUser(r.blocked)] : []));
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

    async setBlock(userId, on) {
      const uid = await requireUser();
      if (userId === uid) throw new UserFacingError("You can't block yourself.");
      if (on) await insertEdge('blocks', { blocked_id: userId });
      else await deleteEdge('blocks', { blocker_id: uid, blocked_id: userId });
    },

    async setMute(userId, on) {
      const uid = await requireUser();
      if (userId === uid) throw new UserFacingError("You can't mute yourself.");
      if (on) await insertEdge('mutes', { muted_id: userId });
      else await deleteEdge('mutes', { muter_id: uid, muted_id: userId });
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
      if (error) throw writeError(error);
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
      if (error) throw writeError(error);
    },

    updateProfile,

    async uploadAvatar(image) {
      const uid = await requireUser();
      const bucket = client.storage.from(AVATAR_BUCKET);
      const ext = image.mimeType === 'image/png' ? 'png' : image.mimeType === 'image/webp' ? 'webp' : 'jpg';
      // A new name every time, so cached copies of the old photo never show.
      const path = `${uid}/${Date.now()}.${ext}`;
      const body = image.file ?? (await (await fetch(image.uri)).arrayBuffer());

      const { error } = await bucket.upload(path, body, { contentType: image.mimeType, cacheControl: '31536000' });
      if (error) {
        if (/exceed|too large|size/i.test(error.message)) throw new UserFacingError('That photo is too big (5 MB max).');
        if (/mime|type/i.test(error.message)) throw new UserFacingError('Use a JPG, PNG or WebP photo.');
        throw new Error(error.message);
      }

      const user = await updateProfile({ avatarUrl: bucket.getPublicUrl(path).data.publicUrl });

      // Tidy up earlier photos. Best effort: a leftover file costs almost nothing.
      const { data: files } = await bucket.list(uid);
      const stale = (files ?? []).map((f) => `${uid}/${f.name}`).filter((p) => p !== path);
      if (stale.length) await bucket.remove(stale).catch(() => {});
      return user;
    },

    async recordView(reelId) {
      await client.rpc('record_view', { p_reel_id: reelId });
    },

    async recordShare(reelId) {
      await client.rpc('record_share', { p_reel_id: reelId });
    },

    async registerPushToken(token, platform) {
      await requireUser();
      const { error } = await client.rpc('register_push_token', { p_token: token, p_platform: platform });
      if (error) throw new Error(error.message);
    },

    async unregisterPushToken(token) {
      const { error } = await client.rpc('unregister_push_token', { p_token: token });
      if (error) throw new Error(error.message);
    },

    async startUpload({ caption, tags, durationSec, fileType, fileSize }) {
      await requireUser();
      return videos<UploadTicket>({ action: 'create', caption, tags, durationSec, fileType, fileSize });
    },

    async uploadStatus(reelId) {
      await requireUser();
      return (await videos<{ status: ReelStatus }>({ action: 'refresh', reelId })).status;
    },

    async deleteReel(reelId) {
      await requireUser();
      await videos({ action: 'delete', reelId });
    },
  };
}
