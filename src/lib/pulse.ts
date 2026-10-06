/**
 * Pulse Rank: ranks from all-time Pulse Points (earned in the database, see
 * supabase/migrations/20261006100000_pulse.sql). The week resets Monday 00:00 Lagos time.
 */

export type Rank = { name: string; min: number };

export const RANKS: readonly Rank[] = [
  { name: 'Grassroots', min: 0 },
  { name: 'Academy', min: 100 },
  { name: 'First Team', min: 500 },
  { name: 'Captain', min: 2000 },
  { name: 'Legend', min: 10000 },
];

/** Current rank, the next one (null at Legend), and 0–1 progress towards it. */
export function rankFor(points: number) {
  let i = 0;
  while (i + 1 < RANKS.length && points >= RANKS[i + 1].min) i++;
  const rank = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  const progress = next ? (points - rank.min) / (next.min - rank.min) : 1;
  return { rank, next, progress: Math.min(Math.max(progress, 0), 1), toNext: next ? next.min - points : 0 };
}

/** Lagos is UTC+1 all year (no daylight saving). */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** When this week's tables reset: next Monday 00:00 in Lagos. */
export function weekEndsAt(now = Date.now()): number {
  const lagos = new Date(now + LAGOS_OFFSET_MS);
  const daysToMonday = (8 - lagos.getUTCDay()) % 7 || 7;
  const monday = Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() + daysToMonday);
  return monday - LAGOS_OFFSET_MS;
}

/** "2d 5h", "5h 12m" or "12m" until the reset. */
export function timeLeft(until: number, now = Date.now()) {
  const mins = Math.max(0, Math.floor((until - now) / 60_000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** 1 → "1st", 2 → "2nd", 11 → "11th"… */
export function ordinal(n: number) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
}
