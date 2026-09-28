import { router, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { engagement } from '@/lib/engagement-store';
import { queryClient, useMe } from '@/lib/queries';
import { useSessionUserId } from '@/lib/session';

/**
 * Reacts to sign-in state: refetches everything when the user changes, and sends a new account
 * to profile setup until they've picked a username.
 */
export function AuthGate() {
  const uid = useSessionUserId();
  const { data: me } = useMe();
  const segments = useSegments();
  const navReady = !!useRootNavigationState()?.key;
  const previous = useRef(uid);

  useEffect(() => {
    if (previous.current === uid) return;
    const wasKnown = previous.current !== undefined;
    previous.current = uid;
    if (!wasKnown) return; // first answer from storage at startup, nothing cached yet
    engagement.reset();
    queryClient.invalidateQueries();
  }, [uid]);

  useEffect(() => {
    if (!navReady) return;
    const here = segments[0] as string | undefined;
    if (me && me.onboarded === false && here !== 'onboarding' && here !== 'auth') {
      router.replace('/onboarding');
    }
  }, [me, segments, navReady]);

  return null;
}
