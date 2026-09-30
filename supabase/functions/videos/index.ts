// Supabase Edge Function entry point. Logic lives in ./handler.ts.
// Deploy:  npx supabase functions deploy videos --no-verify-jwt --use-api
// (The function checks the signed-in user itself; the webhook route has no user.)
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handle, type BunnyConfig } from './handler.ts';

const env = (name: string) => Deno.env.get(name)?.trim() ?? '';

/** Secret (service) key: new-style `SUPABASE_SECRET_KEYS`, else the legacy service_role key. */
function secretKey() {
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}') as Record<string, string>;
    const key = keys.default ?? Object.values(keys)[0];
    if (key) return key;
  } catch {
    // fall through
  }
  return env('SUPABASE_SERVICE_ROLE_KEY');
}

const db = createClient(env('SUPABASE_URL'), secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const bunny: BunnyConfig | null =
  env('BUNNY_LIBRARY_ID') && env('BUNNY_API_KEY') && env('BUNNY_CDN_HOSTNAME')
    ? {
        libraryId: env('BUNNY_LIBRARY_ID'),
        apiKey: env('BUNNY_API_KEY'),
        cdnHost: env('BUNNY_CDN_HOSTNAME').replace(/^https?:\/\//, '').replace(/\/+$/, ''),
        webhookKey: env('BUNNY_READONLY_API_KEY') || undefined,
      }
    : null;

if (!bunny) console.error('videos: set BUNNY_LIBRARY_ID, BUNNY_API_KEY and BUNNY_CDN_HOSTNAME secrets');

Deno.serve((req) =>
  handle(req, {
    db,
    bunny,
    userIdFromToken: async (token) => {
      const { data, error } = await db.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
  }),
);
