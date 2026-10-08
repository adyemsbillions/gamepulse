/**
 * Saving Moments to the gallery with the GamePulse watermark (see media-tools / gamepulse-media).
 * One at a time; progress is shown by <DownloadHost /> in the root layout.
 */
import { useSyncExternalStore } from 'react';

import { toast } from '@/components/ui/toast';

import { onMediaProgress, saveMomentToGallery } from './media-tools';
import type { Reel } from './types';

export type DownloadState = { stage: 'downloading' | 'branding' | 'saving'; progress: number; username: string };

let state: DownloadState | null = null;
const listeners = new Set<() => void>();
const set = (next: DownloadState | null) => {
  state = next;
  listeners.forEach((l) => l());
};

export function useDownload(): DownloadState | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export async function downloadMoment(reel: Reel) {
  if (state) {
    toast.show({ emoji: '⏳', title: 'One download at a time', message: 'Wait for the current one to finish.' });
    return;
  }
  const job = `dl_${Date.now()}`;
  set({ stage: 'downloading', progress: 0, username: reel.creator.username });
  const stop = onMediaProgress(job, (stage, progress) =>
    set({ stage: stage === 'branding' ? 'branding' : 'downloading', progress, username: reel.creator.username }),
  );
  try {
    await saveMomentToGallery({
      job,
      playbackUrl: reel.playbackUrl,
      username: reel.creator.username,
      tag: reel.hashtags[0] ?? null,
    });
    toast.show({ emoji: '🎬', title: 'Saved to your gallery', message: 'Find it in the GamePulse album.' });
  } catch (e) {
    toast.show({
      emoji: '⚠️',
      title: "Couldn't save this Moment",
      message: e instanceof Error ? e.message : 'Check your connection and try again.',
    });
  } finally {
    stop();
    set(null);
  }
}
