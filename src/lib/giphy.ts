/**
 * GIFs and stickers for comments, from GIPHY. Needs EXPO_PUBLIC_GIPHY_KEY in .env.local (free key
 * from developers.giphy.com); without it those tabs explain they aren't set up yet.
 * GIPHY's terms ask for "Powered by GIPHY" wherever its search appears (see sticker-picker).
 */
import type { CommentMedia } from './types';

const KEY = process.env.EXPO_PUBLIC_GIPHY_KEY;
const API = 'https://api.giphy.com/v1';

export const giphyEnabled = !!KEY;

type GiphyImage = { url?: string; webp?: string; width?: string; height?: string };
type GiphyItem = { id: string; images: { fixed_width?: GiphyImage } };

/** Quick picks shown above the sticker search. Empty query = what's trending. */
export const STICKER_CATEGORIES = [
  { label: 'Trending', query: '' },
  { label: 'Love', query: 'love' },
  { label: 'LOL', query: 'laughing' },
  { label: 'Hype', query: 'lets go hype' },
  { label: 'Wow', query: 'shocked wow' },
  { label: 'Sad', query: 'sad crying' },
  { label: 'Party', query: 'party dance' },
  { label: 'Thanks', query: 'thank you' },
  { label: 'Angry', query: 'angry' },
  { label: 'Football', query: 'football soccer' },
  { label: 'Naija', query: 'nigeria' },
] as const;

const GIF_DEFAULT = 'football celebration';

export const searchGifs = (query: string) => search('gifs', query.trim() || GIF_DEFAULT);

/** Transparent animated stickers of any kind; empty query = trending. */
export const searchStickers = (query: string) => search('stickers', query.trim());

async function search(type: 'gifs' | 'stickers', query: string): Promise<CommentMedia[]> {
  if (!KEY) return [];
  const params = new URLSearchParams({ api_key: KEY, limit: '30', rating: 'pg-13' });
  if (query) {
    params.set('q', query);
    params.set('lang', 'en');
  }
  const res = await fetch(`${API}/${type}/${query ? 'search' : 'trending'}?${params}`);
  if (!res.ok) throw new Error(`GIPHY ${res.status}`);
  const body = (await res.json()) as { data?: GiphyItem[] };
  const kind = type === 'stickers' ? 'sticker' : 'gif';
  return (body.data ?? []).flatMap((item) => toMedia(item, kind));
}

/**
 * The 200px-wide WebP (small, animated, keeps sticker transparency) without the tracking query
 * string, which is also the form the database accepts: https://mediaN.giphy.com/media/<path>.webp
 */
function toMedia(item: GiphyItem, kind: CommentMedia['kind']): CommentMedia[] {
  const image = item.images.fixed_width;
  const raw = image?.webp || image?.url;
  if (!raw) return [];
  const url = raw.split('?')[0];
  if (!/^https:\/\/media[0-9]?\.giphy\.com\/media\/[A-Za-z0-9._/-]{1,200}$/.test(url)) return [];
  return [{ kind, url, width: Number(image?.width) || null, height: Number(image?.height) || null }];
}
