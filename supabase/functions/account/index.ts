// Supabase Edge Function entry point. Logic lives in ./handler.ts.
// Deploy:  npx supabase functions deploy account --no-verify-jwt --use-api
// (The handler checks the signed-in user itself.) Uses the same Bunny secrets as `videos`.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handle } from './handler.ts';

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

const libraryId = env('BUNNY_LIBRARY_ID');
const apiKey = env('BUNNY_API_KEY');

async function deleteVideo(guid: string) {
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`, {
    method: 'DELETE',
    headers: { AccessKey: apiKey, Accept: 'application/json' },
  });
  // Already gone is fine.
  if (!res.ok && res.status !== 404) throw new Error(`Bunny ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

Deno.serve((req) =>
  handle(req, {
    db,
    userIdFromToken: async (token) => {
      const { data, error } = await db.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    deleteVideo: libraryId && apiKey ? deleteVideo : null,
    deleteUser: async (userId) => {
      const { error } = await db.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
  }),
);
