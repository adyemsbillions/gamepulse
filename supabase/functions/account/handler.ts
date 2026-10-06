/**
 * The `account` Edge Function: lets a signed-in user delete their own account.
 *
 *   POST /account   { action: 'delete' }
 *
 * Order matters:
 *   1. their videos on Bunny Stream (nothing else would ever delete them)
 *   2. their reels (counters elsewhere are adjusted by the database triggers)
 *   3. their profile photos in storage (storage objects can block deleting the login)
 *   4. the login itself, which cascades to the profile and every row that belongs to it:
 *      comments, cheers, saves, replays, supports, blocks, mutes, notifications, push tokens…
 * A failed video delete is logged and the rest carries on: the person asked to leave, and an
 * orphaned video with no reel pointing at it is unreachable from the app.
 *
 * This file has no runtime imports so it can be tested outside Deno (supabase/tests).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const AVATAR_BUCKET = 'avatars';

export type Deps = {
  /** Service-role client. */
  db: SupabaseClient;
  userIdFromToken: (token: string) => Promise<string | null>;
  /** Deletes one Bunny Stream video; resolves if it's gone (or was already), throws otherwise. */
  deleteVideo: ((guid: string) => Promise<void>) | null;
  /** Deletes the auth user (db.auth.admin.deleteUser in production). */
  deleteUser: (userId: string) => Promise<void>;
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const userId = token ? await deps.userIdFromToken(token) : null;
  if (!userId) return json({ error: 'Sign in first.' }, 401);

  const body = (await req.json().catch(() => ({}))) as { action?: unknown };
  if (body.action !== 'delete') return json({ error: 'Unknown action.' }, 400);

  try {
    const result = await deleteAccount(userId, deps);
    return json({ deleted: true, ...result });
  } catch (e) {
    console.error('account delete failed', userId, e);
    return json({ error: "We couldn't delete your account. Try again, or email us and we'll do it." }, 500);
  }
}

async function deleteAccount(userId: string, deps: Deps) {
  const { db } = deps;

  // 1. Videos on Bunny.
  const reels = await db.from('reels').select('id, video_provider, video_asset_id').eq('user_id', userId);
  if (reels.error) throw reels.error;
  const videos = ((reels.data ?? []) as { video_provider: string | null; video_asset_id: string | null }[])
    .filter((r) => r.video_provider === 'bunny' && r.video_asset_id)
    .map((r) => r.video_asset_id as string);

  let videosFailed = 0;
  if (videos.length && !deps.deleteVideo) {
    console.error('account delete: Bunny not configured; leaving', videos.length, 'videos for', userId);
    videosFailed = videos.length;
  } else if (deps.deleteVideo) {
    for (const guid of videos) {
      try {
        await deps.deleteVideo(guid);
      } catch (e) {
        videosFailed += 1;
        console.error('account delete: video', guid, e);
      }
    }
  }

  // 2. Reels.
  const removed = await db.from('reels').delete().eq('user_id', userId);
  if (removed.error) throw removed.error;

  // 3. Profile photos.
  const bucket = db.storage.from(AVATAR_BUCKET);
  const listed = await bucket.list(userId, { limit: 1000 });
  if (listed.error) throw listed.error;
  const files = (listed.data ?? []).map((f) => `${userId}/${f.name}`);
  if (files.length) {
    const gone = await bucket.remove(files);
    if (gone.error) throw gone.error;
  }

  // 4. The login, and with it everything else.
  await deps.deleteUser(userId);

  return { videos: videos.length, videosFailed, photos: files.length };
}
