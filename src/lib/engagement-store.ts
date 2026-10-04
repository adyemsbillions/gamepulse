/**
 * Optimistic engagement (GP-014): the screen updates the moment you tap, the write goes to the
 * backend in the background, and if it fails the tap is undone and you're told.
 *
 * Server truth comes with the data (`reel.viewer`, `useMySupports()`); this store only holds the
 * taps made since, keyed by id. It's cleared whenever the signed-in user changes.
 */
import { Alert } from 'react-native';
import { useSyncExternalStore } from 'react';

import { data } from './api';
import { requireSignIn } from './auth';
import { UserFacingError } from './data/source';
import { keys, queryClient } from './queries';
import type { Reel } from './types';

type Overrides = ReadonlyMap<string, boolean>;
type State = { cheered: Overrides; saved: Overrides; replayed: Overrides; supporting: Overrides };
type Kind = keyof State;

const empty = (): State => ({ cheered: new Map(), saved: new Map(), replayed: new Map(), supporting: new Map() });
let state: State = empty();
const listeners = new Set<() => void>();

function set(kind: Kind, id: string, value: boolean | undefined) {
  const next = new Map(state[kind]);
  if (value === undefined) next.delete(id);
  else next.set(id, value);
  state = { ...state, [kind]: next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useOverride(kind: Kind, id: string): boolean | undefined {
  return useSyncExternalStore(subscribe, () => state[kind].get(id), () => state[kind].get(id));
}

export function useCheered(reel: Reel) {
  return useOverride('cheered', reel.id) ?? reel.viewer.cheered;
}
export function useSaved(reel: Reel) {
  return useOverride('saved', reel.id) ?? reel.viewer.saved;
}
export function useReplayed(reel: Reel) {
  return useOverride('replayed', reel.id) ?? reel.viewer.replayed;
}
/** `serverValue`: whether the backend says you support them (from useMySupports). */
export function useSupporting(userId: string, serverValue: boolean) {
  return useOverride('supporting', userId) ?? serverValue;
}

/** Counts shown next to an action: the server count, adjusted for taps not yet reflected in it. */
export function adjustCount(serverCount: number, serverOn: boolean, nowOn: boolean) {
  return Math.max(0, serverCount - (serverOn ? 1 : 0) + (nowOn ? 1 : 0));
}

async function optimistic(kind: Kind, id: string, next: boolean, prev: boolean, write: () => Promise<void>) {
  if (!requireSignIn()) return;
  if (next === prev) return;
  set(kind, id, next);
  try {
    await write();
  } catch (e) {
    set(kind, id, prev);
    Alert.alert(
      "That didn't go through",
      e instanceof UserFacingError ? e.message : 'Check your connection and try again.',
    );
  }
}

export const engagement = {
  cheer: (reel: Reel, current: boolean, force?: boolean) => {
    const next = force ?? !current;
    return optimistic('cheered', reel.id, next, current, () => data.setCheer(reel.id, next));
  },
  save: (reel: Reel, current: boolean) =>
    optimistic('saved', reel.id, !current, current, async () => {
      await data.setSave(reel.id, !current);
      queryClient.invalidateQueries({ queryKey: keys.savedFeed });
    }),
  replay: (reel: Reel, current: boolean) =>
    optimistic('replayed', reel.id, !current, current, () => data.setReplay(reel.id, !current)),
  support: (userId: string, current: boolean) =>
    optimistic('supporting', userId, !current, current, () => data.setSupport(userId, !current)),

  /** Drop a local Support tap, e.g. after a block ended the support on the server. */
  forgetSupport: (userId: string) => set('supporting', userId, undefined),

  /** Forget local taps (on sign-in/out, after the data they covered has been refetched). */
  reset: () => {
    state = empty();
    listeners.forEach((l) => l());
  },

  /** Supporting overrides, for the Supporting feed filter. */
  supportingOverrides: () => state.supporting,
};

export function useSupportingOverrides() {
  return useSyncExternalStore(subscribe, () => state.supporting, () => state.supporting);
}
