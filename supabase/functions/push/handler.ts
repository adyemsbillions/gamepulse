/**
 * The `push` Edge Function: sends one notification row to the recipient's phones.
 *
 *   POST /push   { id }   ← called by the notifications_push database trigger (pg_net)
 *
 * The request carries only the notification id; everything else is read from the database with
 * the service key. A notification is sent at most once (the function claims it by setting
 * pushed_at) and only while it's fresh, so a forged call can at most send a push that was going
 * out anyway. No secret needed.
 *
 * This file has no runtime imports so it can be tested outside Deno (supabase/tests).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Older notifications are never pushed (e.g. a retried request long after the fact). */
export const MAX_AGE_MS = 10 * 60_000;
/** Expo accepts up to 100 messages per request. */
const BATCH = 100;
/** Keep in step with PUSH_CHANNEL in src/lib/push.ts. */
const CHANNEL = 'default';

export type NotificationType = 'cheer' | 'comment' | 'new_fan' | 'mention' | 'replay' | 'response' | 'system';

export type ExpoMessage = {
  to: string;
  title?: string;
  body: string;
  data: Record<string, string | null>;
  sound: 'default';
  channelId: string;
  priority: 'high';
};

export type ExpoTicket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

export type Deps = {
  /** Service-role client. */
  db: SupabaseClient;
  /** Sends one batch (≤100) to Expo and returns a ticket per message, in order. */
  send: (messages: ExpoMessage[]) => Promise<ExpoTicket[]>;
  now?: () => number;
};

type Row = {
  id: string;
  recipient_id: string;
  type: NotificationType;
  actor_id: string | null;
  reel_id: string | null;
  comment_id: string | null;
  body: string | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const payload = (await req.json().catch(() => ({}))) as { id?: unknown };
    const id = String(payload.id ?? '');
    if (!UUID.test(id)) return json({ error: 'Bad id' }, 400);

    const { db } = deps;
    const now = deps.now?.() ?? Date.now();

    // Claim it: only one caller ever sends a given notification, and only while it's fresh.
    const claimed = await db
      .from('notifications')
      .update({ pushed_at: new Date(now).toISOString() })
      .eq('id', id)
      .is('pushed_at', null)
      .gte('created_at', new Date(now - MAX_AGE_MS).toISOString())
      .select('id, recipient_id, type, actor_id, reel_id, comment_id, body')
      .maybeSingle();
    if (claimed.error) throw claimed.error;
    const n = claimed.data as Row | null;
    if (!n) return json({ ignored: 'already sent, too old or unknown' });

    const [tokens, actor, comment] = await Promise.all([
      db.from('push_tokens').select('token').eq('user_id', n.recipient_id),
      n.actor_id
        ? db.from('profiles').select('username').eq('id', n.actor_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      n.comment_id
        ? db.from('comments').select('body').eq('id', n.comment_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (tokens.error) throw tokens.error;
    const to = ((tokens.data ?? []) as { token: string }[]).map((t) => t.token);
    if (to.length === 0) return json({ sent: 0 });

    const content = composeMessage(
      n,
      (actor.data as { username: string } | null)?.username ?? null,
      (comment.data as { body: string } | null)?.body ?? null,
    );
    if (!content) return json({ sent: 0 });

    let sent = 0;
    const dead: string[] = [];
    for (let i = 0; i < to.length; i += BATCH) {
      const batch = to.slice(i, i + BATCH);
      const tickets = await deps.send(
        batch.map((token) => ({ to: token, ...content, sound: 'default', channelId: CHANNEL, priority: 'high' })),
      );
      tickets.forEach((t, j) => {
        if (t.status === 'ok') sent += 1;
        // The app was uninstalled or the token rotated: stop sending to it.
        else if (t.details?.error === 'DeviceNotRegistered') dead.push(batch[j]);
        else console.error('push ticket error', t.message);
      });
    }
    if (dead.length) await db.from('push_tokens').delete().in('token', dead);

    return json({ sent });
  } catch (e) {
    console.error(e);
    return json({ error: 'Something went wrong.' }, 500);
  }
}

const ACTIVITY: Record<Exclude<NotificationType, 'system' | 'comment'>, string> = {
  cheer: 'cheered your Moment ⚽',
  new_fan: 'became your Fan',
  mention: 'mentioned you in a comment',
  replay: 'replayed your Moment',
  response: 'responded to your Moment 🎬',
};

/** What the push says, and what the app needs to open the right screen when it's tapped. */
export function composeMessage(
  n: Pick<Row, 'id' | 'type' | 'reel_id' | 'body'>,
  actorUsername: string | null,
  commentBody: string | null,
): Pick<ExpoMessage, 'title' | 'body' | 'data'> | null {
  const data = { notificationId: n.id, type: n.type, reelId: n.reel_id, actorUsername };

  if (n.type === 'system') return n.body ? { title: 'GamePulse', body: n.body, data } : null;
  if (!actorUsername) return null; // the actor's account is gone

  const text =
    n.type === 'comment'
      ? commentBody
        ? `commented: "${truncate(commentBody, 120)}"`
        : 'commented on your Moment'
      : ACTIVITY[n.type];
  return { body: `@${actorUsername} ${text}`, data };
}

function truncate(s: string, max: number) {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
