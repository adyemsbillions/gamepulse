/**
 * Posting a Moment, start to finish:
 *   preparing  → the reel + a signed upload are created (videos Edge Function)
 *   uploading  → the file goes straight to Bunny Stream over TUS (resumable, retried)
 *   processing → Bunny encodes it; we poll until the reel is published
 *   published  → feeds refresh and the banner offers "View"
 * Runs outside any screen, so people can keep scrolling while it posts.
 */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { Upload } from 'tus-js-client';

import { data } from './api';
import { UserFacingError, type UploadTicket } from './data/source';
import { keys, queryClient } from './queries';
import type { ReplyTarget } from './types';

export type PickedVideo = {
  uri: string;
  durationSec: number | null;
  fileSize: number | null;
  mimeType: string;
  width: number;
  height: number;
  /** Web only: the picked File. */
  file?: Blob;
};

export type UploadPhase = 'preparing' | 'uploading' | 'processing' | 'published' | 'failed';

export type UploadJob = {
  id: string;
  video: PickedVideo;
  caption: string;
  tags: string[];
  /** The reel this Moment responds to (a duet), if any. */
  replyTo: string | null;
  phase: UploadPhase;
  /** 0 → 1 while uploading. */
  progress: number;
  reelId: string | null;
  error: string | null;
  /** Encoding is taking longer than we poll for; it'll still publish on its own. */
  slow: boolean;
};

type Internal = { ticket: UploadTicket | null; ticketExpires: number; upload: Upload | null; cancelled: boolean };

let jobs: UploadJob[] = [];
const internals = new Map<string, Internal>();
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const patch = (id: string, change: Partial<UploadJob>) => {
  jobs = jobs.map((j) => (j.id === id ? { ...j, ...change } : j));
  emit();
};
const find = (id: string) => jobs.find((j) => j.id === id);

export function useUploads(): UploadJob[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => jobs,
    () => jobs,
  );
}

/** What a new Moment starts with: a challenge's hashtag, or the Moment it responds to. */
export type DraftPreset = { caption?: string; replyTo?: ReplyTarget; label: string };

// The video picked on the Create tab, handed to the compose screen.
let draft: PickedVideo | null = null;
let preset: DraftPreset | null = null;
let posted = false;
const presetListeners = new Set<() => void>();
export const draftVideo = {
  set: (v: PickedVideo | null) => void (draft = v),
  get: () => draft,
  /** Set from "Join challenge" or "Respond with your Moment"; cleared once posted or dismissed. */
  setPreset: (p: DraftPreset | null) => {
    preset = p;
    presetListeners.forEach((l) => l());
  },
  getPreset: () => preset,
  /** Compose just posted; the Create tab switches to Profile when it's back in focus. */
  markPosted: () => void (posted = true),
  consumePosted: () => {
    const was = posted;
    posted = false;
    return was;
  },
};

export function useDraftPreset(): DraftPreset | null {
  return useSyncExternalStore(
    (l) => {
      presetListeners.add(l);
      return () => presetListeners.delete(l);
    },
    () => preset,
    () => preset,
  );
}

export const uploads = {
  /** Start posting. Returns immediately; follow progress with `useUploads`. */
  post(video: PickedVideo, caption: string, tags: string[], replyTo: string | null = null) {
    const id = `up_${Date.now()}`;
    jobs = [
      { id, video, caption, tags, replyTo, phase: 'preparing', progress: 0, reelId: null, error: null, slow: false },
      ...jobs,
    ];
    internals.set(id, { ticket: null, ticketExpires: 0, upload: null, cancelled: false });
    emit();
    void run(id);
    return id;
  },

  retry(id: string) {
    const job = find(id);
    if (!job || job.phase !== 'failed') return;
    patch(id, { error: null });
    void run(id);
  },

  /** Hide a finished or failed job. A failed one's half-made reel is cleaned up. */
  dismiss(id: string) {
    const job = find(id);
    const internal = internals.get(id);
    if (internal) {
      internal.cancelled = true;
      internal.upload?.abort(true).catch(() => {});
    }
    if (job && job.phase !== 'published' && job.reelId) data.deleteReel(job.reelId).catch(() => {});
    jobs = jobs.filter((j) => j.id !== id);
    internals.delete(id);
    emit();
  },

  isBusy: () => jobs.some((j) => j.phase === 'preparing' || j.phase === 'uploading'),
};

async function run(id: string) {
  const internal = internals.get(id);
  const job = find(id);
  if (!internal || !job) return;

  try {
    // Reuse the reel and signed upload from a failed attempt while it's still valid, so TUS can
    // resume where it stopped instead of starting a second reel.
    let ticket = internal.ticket;
    if (!ticket || Date.now() > internal.ticketExpires) {
      if (internal.ticket?.reelId) data.deleteReel(internal.ticket.reelId).catch(() => {});
      patch(id, { phase: 'preparing', progress: 0 });
      ticket = await data.startUpload({
        caption: job.caption,
        tags: job.tags,
        durationSec: job.video.durationSec,
        fileType: job.video.mimeType,
        fileSize: job.video.fileSize,
        localUri: job.video.uri,
      });
      internal.ticket = ticket;
      internal.upload = null;
      // Link the response now, while the reel is still a draft; the original's creator is told
      // when it's published. Best effort: a failed link just posts it as a normal Moment.
      if (job.replyTo) data.linkResponse(ticket.reelId, job.replyTo).catch(() => {});
      const expire = Number(ticket.upload?.headers.AuthorizationExpire ?? 0) * 1000;
      internal.ticketExpires = expire ? expire - 10 * 60_000 : Date.now() + 60 * 60_000;
    }
    if (internal.cancelled) return;
    patch(id, { reelId: ticket.reelId, phase: 'uploading' });

    if (ticket.upload) await sendFile(id, internal, job.video, ticket.upload);
    else await simulateUpload(id);
    if (internal.cancelled) return;

    patch(id, { phase: 'processing', progress: 1 });
    const status = await waitUntilPublished(ticket.reelId, internal);
    if (internal.cancelled) return;

    if (status === 'published') {
      internal.ticket = null;
      patch(id, { phase: 'published' });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['hashtags'] });
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: keys.reel(ticket.reelId) });
    } else if (status === 'failed' || status === 'removed') {
      internal.ticket = null;
      throw new UserFacingError("We couldn't process that video. Try another clip.");
    } else {
      patch(id, { slow: true });
    }
  } catch (e) {
    if (internal.cancelled) return;
    patch(id, {
      phase: 'failed',
      error: e instanceof UserFacingError ? e.message : 'Upload stopped. Check your connection and retry.',
    });
  }
}

function sendFile(
  id: string,
  internal: Internal,
  video: PickedVideo,
  target: NonNullable<UploadTicket['upload']>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // tus-js-client reads `{ uri }` on React Native and a Blob/File on the web.
    const input = Platform.OS === 'web' && video.file ? video.file : ({ uri: video.uri } as unknown as Blob);
    // Resume an earlier attempt on the same video, if the host already has part of it.
    const previousUrl = internal.upload?.url ?? null;
    const upload = new Upload(input, {
      endpoint: target.endpoint,
      uploadUrl: previousUrl,
      headers: target.headers,
      metadata: target.metadata,
      chunkSize: 8 * 1024 * 1024,
      retryDelays: [0, 2_000, 5_000, 10_000, 20_000, 30_000, 60_000],
      storeFingerprintForResuming: false,
      onProgress: (sent, total) => patch(id, { progress: total > 0 ? sent / total : 0 }),
      onSuccess: () => resolve(),
      onError: (err) => reject(err),
    });
    internal.upload = upload;
    upload.start();
  });
}

async function simulateUpload(id: string) {
  for (let p = 0.1; p <= 1; p += 0.15) {
    await sleep(180);
    patch(id, { progress: Math.min(p, 1) });
  }
}

/** Poll the host until the reel is published or failed (about 15 minutes at most). */
async function waitUntilPublished(reelId: string, internal: Internal) {
  const started = Date.now();
  let delay = 3_000;
  while (!internal.cancelled && Date.now() - started < 15 * 60_000) {
    try {
      const status = await data.uploadStatus(reelId);
      if (status === 'published' || status === 'failed' || status === 'removed') return status;
    } catch {
      // Transient; keep polling.
    }
    await sleep(delay);
    delay = Math.min(delay * 1.5, 15_000);
  }
  return 'processing' as const;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
