// Supabase Edge Function entry point. Logic lives in ./handler.ts.
// Deploy:  npx supabase functions deploy push --no-verify-jwt --use-api
// (Called by the database, which has no user token. The handler needs no secret; see handler.ts.)
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handle, type ExpoMessage, type ExpoTicket } from './handler.ts';

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

/** Only needed if "Enhanced push security" is turned on in the EAS dashboard. */
const expoToken = env('EXPO_ACCESS_TOKEN');

async function send(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
    },
    body: JSON.stringify(messages),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(body?.data)) throw new Error(`Expo push ${res.status}: ${JSON.stringify(body)}`);
  return body.data as ExpoTicket[];
}

Deno.serve((req) => handle(req, { db, send }));
