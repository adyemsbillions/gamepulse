/**
 * Client-side engagement state (Cheers, Saves, Replays, Supporting, new comments).
 * Optimistic and in-memory for the prototype; later these actions call the backend and this
 * store becomes the optimistic cache in front of it.
 */
import { useSyncExternalStore } from 'react';

import { CURRENT_USER_ID } from './api';
import type { Comment } from './types';

type State = {
  cheered: ReadonlySet<string>;
  saved: ReadonlySet<string>;
  replayed: ReadonlySet<string>;
  supporting: ReadonlySet<string>;
  newComments: readonly Comment[];
};

let state: State = {
  cheered: new Set(),
  saved: new Set(),
  replayed: new Set(),
  supporting: new Set(['u_2']),
  newComments: [],
};

const listeners = new Set<() => void>();

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useEngagement<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

function toggle(set: ReadonlySet<string>, id: string, force?: boolean) {
  const next = new Set(set);
  const on = force ?? !next.has(id);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

export const engagement = {
  toggleCheer: (reelId: string, force?: boolean) =>
    setState({ cheered: toggle(state.cheered, reelId, force) }),
  toggleSave: (reelId: string) => setState({ saved: toggle(state.saved, reelId) }),
  toggleReplay: (reelId: string) => setState({ replayed: toggle(state.replayed, reelId) }),
  toggleSupport: (userId: string) => setState({ supporting: toggle(state.supporting, userId) }),
  addComment: (reelId: string, text: string) =>
    setState({
      newComments: [
        ...state.newComments,
        {
          id: `local_${Date.now()}`,
          reelId,
          userId: CURRENT_USER_ID,
          text,
          parentId: null,
          cheers: 0,
          createdAt: new Date().toISOString(),
        },
      ],
    }),
};
