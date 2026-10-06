import type { ImageSource } from 'expo-image';
import type { VideoSource } from 'expo-video';
import { Platform } from 'react-native';

/**
 * Bunny Stream's "Block direct URL file access" refuses CDN requests that carry no Referer.
 * Browsers always send one, but the native video and image loaders don't, so on Android/iOS every
 * playlist, segment and thumbnail came back 403. Send one ourselves (browsers forbid setting it).
 */
const HEADERS = Platform.OS === 'web' ? undefined : { Referer: 'https://gamepulse.app/' };

/**
 * Buffering for short vertical clips: start after 1 s instead of 2, and keep 10 s ahead instead
 * of 20, so the preloaded neighbours in the feed don't each hold 20 s of video in memory.
 */
const BUFFER = { preferredForwardBufferDuration: 10, minBufferForPlayback: 1, maxBufferBytes: 24 * 1024 * 1024 };

export const videoSource = (uri: string): VideoSource => ({ uri, headers: HEADERS, useCaching: true });

export const videoBufferOptions = BUFFER;

export const imageSource = (uri: string): ImageSource | null => (uri ? { uri, headers: HEADERS } : null);

// ---------------------------------------------------------------- picking the quality

/** Sharp on a phone screen at about 2.5 Mbps; 1080p costs 6–7 Mbps for little visible gain. */
const TARGET_SHORT_SIDE = 720;

const chosen = new Map<string, Promise<string>>();

/**
 * The stream to play for a video. Bunny's HLS playlist lists 360p first, and the player starts on
 * the first entry and rarely climbs before a short clip ends, so Moments looked soft. Instead we
 * read the list and play the best quality up to 720p directly. Anything unexpected (not HLS,
 * offline, odd playlist) falls back to the original URL, which plays as before.
 */
export function playbackUrl(masterUrl: string): Promise<string> {
  if (Platform.OS === 'web' || !masterUrl.endsWith('.m3u8')) return Promise.resolve(masterUrl);
  let pending = chosen.get(masterUrl);
  if (!pending) {
    pending = pickRendition(masterUrl).catch(() => masterUrl);
    chosen.set(masterUrl, pending);
  }
  return pending;
}

async function pickRendition(masterUrl: string): Promise<string> {
  const res = await fetch(masterUrl, { headers: HEADERS });
  if (!res.ok) return masterUrl;
  const lines = (await res.text()).split(/\r?\n/);

  let best: { url: string; side: number } | null = null;
  let fallback: { url: string; side: number } | null = null;
  for (let i = 0; i < lines.length; i++) {
    const match = /RESOLUTION=(\d+)x(\d+)/.exec(lines[i]);
    const uri = lines[i + 1]?.trim();
    if (!lines[i].startsWith('#EXT-X-STREAM-INF') || !match || !uri || uri.startsWith('#')) continue;
    const side = Math.min(Number(match[1]), Number(match[2]));
    const url = new URL(uri, masterUrl).toString();
    if (side <= TARGET_SHORT_SIDE && (!best || side > best.side)) best = { url, side };
    if (!fallback || side < fallback.side) fallback = { url, side };
  }
  // Nothing at or under 720p (unusual): the smallest one is still better than guessing.
  return best?.url ?? fallback?.url ?? masterUrl;
}
