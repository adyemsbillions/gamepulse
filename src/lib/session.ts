/**
 * Who is signed in. Mock mode is always signed in as the sample user; live mode follows the
 * Supabase auth session (sign-in screens arrive with GP-012).
 */
import { useSyncExternalStore } from 'react';

import { CURRENT_USER_ID } from './mock-data';
import { supabase } from './supabase';

/** `undefined` while the stored session is still loading, `null` when signed out. */
let userId: string | null | undefined = supabase ? undefined : CURRENT_USER_ID;
const listeners = new Set<() => void>();

function set(next: string | null) {
  if (next === userId) return;
  userId = next;
  listeners.forEach((l) => l());
}

if (supabase) {
  supabase.auth.getSession().then(({ data }) => set(data.session?.user.id ?? null));
  supabase.auth.onAuthStateChange((_event, session) => set(session?.user.id ?? null));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current signed-in user id, for event handlers (not render). */
export function getSessionUserId(): string | null | undefined {
  return userId;
}

export function useSessionUserId(): string | null | undefined {
  return useSyncExternalStore(subscribe, () => userId, () => userId);
}
