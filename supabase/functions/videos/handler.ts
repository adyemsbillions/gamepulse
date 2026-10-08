/**
 * The `videos` Edge Function: everything between the app and Bunny Stream.
 *
 *   POST /videos            { action: 'create', caption, tags, durationSec, fileType, fileSize }
 *                           → creates the reel + the Bunny video, returns a signed TUS upload
 *   POST /videos            { action: 'refresh', reelId }  → asks Bunny where the video is up to
 *   POST /videos            { action: 'delete',  reelId }  → deletes the reel and its video
 *   POST /videos/webhook    Bunny's encoding webhook (no user; signature-checked)
 *
 * The Bunny API key never leaves this function. Reel status is only ever moved on what Bunny's
 * own API reports, so a forged webhook can't publish anything.
 *
 * This file has no runtime imports so it can be tested outside Deno (supabase/tests).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const LIMITS = {
  /** 3-minute Moments, with a little slack for encoders that round up. Keep in step with the app. */
  maxDurationSec: 182,
  maxFileBytes: 500 * 1024 * 1024,
  uploadsPerDay: 20,
  maxTags: 10,
  captionLength: 2200,
  /** How long the signed upload stays valid. */
  uploadTtlSec: 6 * 60 * 60,
};

const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';

export type BunnyConfig = {
  libraryId: string;
  /** Library API key (Stream → library → API). Server-side only. */
  apiKey: string;
  /** Library CDN hostname, e.g. vz-abc123-456.b-cdn.net */
  cdnHost: string;
  /** Library read-only API key; Bunny signs webhooks with it. Optional. */
  webhookKey?: string;
  /** Overrides for local tests. */
  apiBase?: string;
  tusEndpoint?: string;
};

export type Deps = {
  /** Service-role client. */
  db: SupabaseClient;
  bunny: BunnyConfig | null;
  userIdFromToken: (token: string) => Promise<string | null>;
  now?: () => number;
};

type ReelStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'published' | 'removed';

type ReelRow = {
  id: string;
  user_id: string;
  status: ReelStatus;
  video_provider: string | null;
  video_asset_id: string | null;
  duration_sec: number | string | null;
  created_at?: string;
};

type BunnyVideo = {
  guid: string;
  /** Get Video's VideoModelStatus (NOT the webhook's status codes; see statusFor). */
  status: number;
  length: number;
  thumbnailFileName?: string | null;
  /** 0–100 while transcoding. */
  encodeProgress?: number | null;
  /** Resolutions already playable, e.g. "360p,720p". */
  availableResolutions?: string | null;
};

const IN_FLIGHT: ReelStatus[] = ['uploading', 'processing', 'ready'];
const REEL_COLUMNS = 'id, user_id, status, video_provider, video_asset_id, duration_sec, created_at';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

class BunnyError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`Bunny API ${status}: ${body.slice(0, 200)}`);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    if (!deps.bunny) throw new HttpError(503, 'Uploads are not set up yet.');
    const bunny = deps.bunny;

    if (new URL(req.url).pathname.endsWith('/webhook')) return await webhook(req, deps, bunny);

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const userId = token ? await deps.userIdFromToken(token) : null;
    if (!userId) throw new HttpError(401, 'Sign in first.');

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    switch (body.action) {
      case 'create':
        return json(await createUpload(body, userId, deps, bunny));
      case 'refresh':
        // { status, progress }: progress is Bunny's encoding % while it's processing.
        return json(await refresh(String(body.reelId ?? ''), userId, deps, bunny));
      case 'delete':
        await remove(String(body.reelId ?? ''), userId, deps, bunny);
        return json({ deleted: true });
      default:
        throw new HttpError(400, 'Unknown action.');
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong. Try again.' }, 500);
  }
}

// ---------------------------------------------------------------- create

export function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const tags = input
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.replace(/^#/, '').toLowerCase())
    .filter((t) => /^[a-z0-9_]{1,50}$/.test(t));
  return [...new Set(tags)].slice(0, LIMITS.maxTags);
}

async function createUpload(body: Record<string, unknown>, userId: string, deps: Deps, bunny: BunnyConfig) {
  const { db } = deps;

  const caption = typeof body.caption === 'string' ? body.caption.trim() : '';
  if (caption.length > LIMITS.captionLength) throw new HttpError(400, 'Caption is too long (2,200 characters max).');

  const duration = Number(body.durationSec);
  const durationSec = Number.isFinite(duration) && duration > 0 ? Math.round(duration * 100) / 100 : null;
  if (durationSec && durationSec > LIMITS.maxDurationSec) throw new HttpError(400, 'Moments can be up to 3 minutes.');

  const size = Number(body.fileSize);
  if (Number.isFinite(size) && size > LIMITS.maxFileBytes) throw new HttpError(400, 'That video is too big (500 MB max).');

  const fileType =
    typeof body.fileType === 'string' && /^video\/[\w.+-]{1,40}$/.test(body.fileType) ? body.fileType : 'video/mp4';
  const tags = normalizeTags(body.tags);

  const profile = await db.from('profiles').select('onboarded').eq('id', userId).maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data?.onboarded) throw new HttpError(403, 'Finish setting up your profile first.');

  const recent = await db.rpc('recent_upload_count', { p_user_id: userId });
  if (recent.error) throw recent.error;
  if ((recent.data as number) >= LIMITS.uploadsPerDay)
    throw new HttpError(429, 'Daily posting limit reached. Try again tomorrow.');

  const inserted = await db
    .from('reels')
    .insert({ user_id: userId, caption, duration_sec: durationSec, status: 'uploading', video_provider: 'bunny' })
    .select('id')
    .single();
  if (inserted.error) throw inserted.error;
  const reelId = (inserted.data as { id: string }).id;

  let video: BunnyVideo;
  try {
    video = (await bunnyApi(bunny, 'POST', '/videos', { title: reelId })) as BunnyVideo;
  } catch (e) {
    console.error(e);
    await db.from('reels').delete().eq('id', reelId);
    throw new HttpError(502, "Couldn't start the upload. Try again.");
  }

  const linked = await db.from('reels').update({ video_asset_id: video.guid }).eq('id', reelId);
  if (linked.error) throw linked.error;

  if (tags.length > 0) {
    const tagged = await db.from('reel_hashtags').insert(tags.map((tag) => ({ reel_id: reelId, tag })));
    if (tagged.error) throw tagged.error;
  }

  const expires = Math.floor((deps.now?.() ?? Date.now()) / 1000) + LIMITS.uploadTtlSec;
  const signature = await sha256Hex(`${bunny.libraryId}${bunny.apiKey}${expires}${video.guid}`);

  return {
    reelId,
    upload: {
      endpoint: bunny.tusEndpoint ?? TUS_ENDPOINT,
      headers: {
        AuthorizationSignature: signature,
        AuthorizationExpire: String(expires),
        VideoId: video.guid,
        LibraryId: String(bunny.libraryId),
      },
      metadata: { filetype: fileType, title: reelId },
    },
  };
}

// ---------------------------------------------------------------- refresh / delete

async function ownReel(db: SupabaseClient, reelId: string, userId: string): Promise<ReelRow> {
  if (!/^[0-9a-f-]{36}$/i.test(reelId)) throw new HttpError(404, 'Moment not found.');
  const res = await db.from('reels').select(REEL_COLUMNS).eq('id', reelId).maybeSingle();
  if (res.error) throw res.error;
  const reel = res.data as ReelRow | null;
  if (!reel || reel.user_id !== userId) throw new HttpError(404, 'Moment not found.');
  return reel;
}

async function refresh(reelId: string, userId: string, deps: Deps, bunny: BunnyConfig) {
  return sync(await ownReel(deps.db, reelId, userId), deps, bunny);
}

async function remove(reelId: string, userId: string, deps: Deps, bunny: BunnyConfig) {
  const reel = await ownReel(deps.db, reelId, userId);
  if (reel.video_provider === 'bunny' && reel.video_asset_id) {
    try {
      await bunnyApi(bunny, 'DELETE', `/videos/${reel.video_asset_id}`);
    } catch (e) {
      // Already gone on Bunny is fine; anything else is logged and the reel is still removed.
      if (!(e instanceof BunnyError && e.status === 404)) console.error(e);
    }
  }
  const res = await deps.db.from('reels').delete().eq('id', reel.id);
  if (res.error) throw res.error;
}

// ---------------------------------------------------------------- status sync

/**
 * Reel status for what Bunny's Get Video API reports, or null to leave it as it is.
 *
 * Get Video uses VideoModelStatus, which is NOT the same numbering as the webhook's Status field
 * (the webhook only tells us to look; sync() always reads Get Video). Mixing them up left uploads
 * stuck on "processing" (6 = UploadFailed was ignored) and failed playable JIT videos (8).
 *   0 Created · 1 Uploaded · 2 Processing · 3 Transcoding · 4 Finished · 5 Error
 *   6 UploadFailed · 7 JitSegmenting · 8 JitPlaylistsCreated
 */
export function statusFor(video: Pick<BunnyVideo, 'status' | 'availableResolutions'>): ReelStatus | null {
  const playable = !!video.availableResolutions?.trim();
  switch (video.status) {
    case 4: // finished
    case 8: // JIT playlists ready: playable
      return 'published';
    case 3: // transcoding: live as soon as the first resolution is done
    case 7: // JIT segmenting
      return playable ? 'published' : 'processing';
    case 1: // uploaded
    case 2: // processing
      return 'processing';
    case 5: // error
    case 6: // upload failed
      return 'failed';
    default: // 0 created: the file hasn't arrived yet
      return null;
  }
}

/** A video Bunny still hasn't received this long after the reel was created never will be. */
const NEVER_ARRIVED_MS = 3 * 60 * 60 * 1000;

type Synced = { status: ReelStatus; progress: number | null };

/** Bring one reel in line with what Bunny reports: its status afterwards, and encoding progress. */
async function sync(reel: ReelRow, deps: Deps, bunny: BunnyConfig): Promise<Synced> {
  const done = (status: ReelStatus, progress: number | null = null): Synced => ({ status, progress });
  if (!IN_FLIGHT.includes(reel.status) || reel.video_provider !== 'bunny' || !reel.video_asset_id) return done(reel.status);
  const guid = reel.video_asset_id;

  let video: BunnyVideo;
  try {
    video = (await bunnyApi(bunny, 'GET', `/videos/${guid}`)) as BunnyVideo;
  } catch (e) {
    if (e instanceof BunnyError && e.status === 404) return done(await update(deps.db, reel, { status: 'failed' }));
    throw e;
  }

  // The app checks length before uploading; this is the check that can't be skipped.
  if (video.length > LIMITS.maxDurationSec) {
    await bunnyApi(bunny, 'DELETE', `/videos/${guid}`).catch((e) => console.error(e));
    return done(await update(deps.db, reel, { status: 'failed' }));
  }

  let next = statusFor(video);
  const now = deps.now?.() ?? Date.now();
  if (!next && video.status === 0 && reel.created_at && now - Date.parse(reel.created_at) > NEVER_ARRIVED_MS) {
    next = 'failed';
  }
  const progress = typeof video.encodeProgress === 'number' ? Math.max(0, Math.min(100, video.encodeProgress)) : null;

  if (!next || next === reel.status) return done(reel.status, progress);
  if (next === 'processing' && reel.status !== 'uploading') return done(reel.status, progress);

  const patch: Record<string, unknown> = { status: next };
  if (next === 'published') {
    patch.playback_url = `https://${bunny.cdnHost}/${guid}/playlist.m3u8`;
    patch.thumbnail_url = `https://${bunny.cdnHost}/${guid}/${video.thumbnailFileName || 'thumbnail.jpg'}`;
    if (video.length > 0) patch.duration_sec = video.length;
  }
  return done(await update(deps.db, reel, patch), progress);
}

async function update(db: SupabaseClient, reel: ReelRow, patch: Record<string, unknown>): Promise<ReelStatus> {
  // Only move reels that are still in flight, so a late webhook can't undo a removal.
  const res = await db.from('reels').update(patch).eq('id', reel.id).in('status', IN_FLIGHT).select('status');
  if (res.error) throw res.error;
  const row = (res.data as { status: ReelStatus }[] | null)?.[0];
  return row?.status ?? reel.status;
}

// ---------------------------------------------------------------- webhook

async function webhook(req: Request, deps: Deps, bunny: BunnyConfig) {
  const raw = await req.text();

  if (bunny.webhookKey) {
    const given = (req.headers.get('X-BunnyStream-Signature') ?? '').toLowerCase();
    const expected = await hmacSha256Hex(bunny.webhookKey, raw);
    if (!timingSafeEqual(given, expected)) return json({ error: 'Bad signature' }, 401);
  }

  let payload: { VideoLibraryId?: unknown; VideoGuid?: unknown };
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Bad payload' }, 400);
  }
  if (String(payload.VideoLibraryId) !== String(bunny.libraryId)) return json({ ignored: 'other library' });

  const guid = String(payload.VideoGuid ?? '');
  if (!guid) return json({ ignored: 'no video' });

  const res = await deps.db
    .from('reels')
    .select(REEL_COLUMNS)
    .eq('video_provider', 'bunny')
    .eq('video_asset_id', guid)
    .maybeSingle();
  if (res.error) throw res.error;
  if (!res.data) return json({ ignored: 'unknown video' });

  return json({ status: (await sync(res.data as ReelRow, deps, bunny)).status });
}

// ---------------------------------------------------------------- helpers

async function bunnyApi(bunny: BunnyConfig, method: string, path: string, body?: unknown): Promise<unknown> {
  const base = bunny.apiBase ?? 'https://video.bunnycdn.com';
  const res = await fetch(`${base}/library/${bunny.libraryId}${path}`, {
    method,
    headers: {
      AccessKey: bunny.apiKey,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new BunnyError(res.status, text);
  return text ? JSON.parse(text) : null;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256Hex(input: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
}

export async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
