/**
 * GamePulse's native media tools (modules/gamepulse-media, Android): compress before upload, and
 * save a Moment with the GamePulse watermark. Optional: when the module isn't in this build (iOS,
 * web, older APKs), uploads go as they are and the download option is hidden.
 */
import { requireOptionalNativeModule } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

type ProgressEvent = { job: string; stage: 'compressing' | 'downloading' | 'branding'; progress: number };

type NativeMedia = {
  compress(uri: string, job: string): Promise<string | null>;
  saveWatermarked(options: {
    job: string;
    urls: string[];
    referer: string;
    username: string;
    tag?: string | null;
    fileName: string;
  }): Promise<string>;
  addListener(event: 'onProgress', listener: (e: ProgressEvent) => void): { remove(): void };
};

const native = requireOptionalNativeModule<NativeMedia>('GamePulseMedia');

export const mediaToolsAvailable = !!native;

/** Progress events for one job id. Returns an unsubscribe. */
export function onMediaProgress(job: string, listener: (stage: ProgressEvent['stage'], progress: number) => void) {
  if (!native) return () => {};
  const sub = native.addListener('onProgress', (e) => e.job === job && listener(e.stage, e.progress));
  return () => sub.remove();
}

/**
 * A 720p copy of the clip for upload, or null to upload the original (already small, module
 * missing, or compression failed: never block posting on this).
 */
export async function compressForUpload(uri: string, job: string): Promise<string | null> {
  if (!native) return null;
  try {
    return await native.compress(uri, job);
  } catch {
    return null;
  }
}

/** Bunny "MP4 fallback" files for a reel, best first (needs MP4 Fallback on in the library). */
function mp4Urls(playbackUrl: string) {
  const base = playbackUrl.replace(/playlist\.m3u8(\?.*)?$/, '');
  return ['play_720p.mp4', 'play_480p.mp4', 'play_360p.mp4', 'play_240p.mp4'].map((f) => base + f);
}

/** Download a Moment with the GamePulse badge + @username and an end card, into the gallery. */
export async function saveMomentToGallery(input: {
  job: string;
  playbackUrl: string;
  username: string;
  tag?: string | null;
}): Promise<string> {
  if (!native) throw new Error('Downloads need the latest version of GamePulse.');
  if (Platform.OS === 'android' && Number(Platform.Version) < 29) {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    if (result !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('GamePulse needs storage access to save videos.');
  }
  return native.saveWatermarked({
    job: input.job,
    urls: mp4Urls(input.playbackUrl),
    referer: 'https://gamepulse.app/',
    username: input.username,
    tag: input.tag ?? null,
    fileName: `GamePulse-${input.username}-${Date.now()}`,
  });
}
