import type { ImageSource } from 'expo-image';
import type { VideoSource } from 'expo-video';
import { Platform } from 'react-native';

/**
 * Bunny Stream's "Block direct URL file access" refuses CDN requests that carry no Referer.
 * Browsers always send one, but the native video and image loaders don't, so on Android/iOS every
 * playlist, segment and thumbnail came back 403. Send one ourselves (browsers forbid setting it).
 */
const HEADERS = Platform.OS === 'web' ? undefined : { Referer: 'https://gamepulse.app/' };

export const videoSource = (uri: string): VideoSource => ({ uri, headers: HEADERS, useCaching: true });

export const imageSource = (uri: string): ImageSource | null => (uri ? { uri, headers: HEADERS } : null);
