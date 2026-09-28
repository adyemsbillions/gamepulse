/**
 * Data access seam. Screens read through the hooks in `queries.ts`, which call `data` here.
 * With EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY set, `data` reads Supabase; otherwise it serves
 * the bundled sample data so the app still runs without a backend.
 */
import { mockSource } from './data/mock-source';
import { createSupabaseSource } from './data/supabase-source';
import { clubs } from './mock-data';
import { supabase } from './supabase';

export { normalizeHashtag, type FeedFilter, type SearchResults } from './data/source';

export const data = supabase ? createSupabaseSource(supabase) : mockSource;

/** True when the app is talking to a real Supabase project. */
export const isLive = data.kind === 'supabase';

/** Reference list shown on Discover until clubs get their own table. */
export function getClubs(): readonly string[] {
  return clubs;
}
