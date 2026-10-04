import { router, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { engagement } from '@/lib/engagement-store';
import { openPush, registerForPush, useLastPushResponse, watchIncomingPushes } from '@/lib/push';
import { queryClient, useMe } from '@/lib/queries';
import { useSessionUserId } from '@/lib/session';

/**
 * Reacts to sign-in state: refetches everything when the user changes, sends a new account to
 * profile setup until they've picked a username, and sets up push notifications once they have.
 */
export function AuthGate() {
  const uid = useSessionUserId();
  const { data: me } = useMe();
  const segments = useSegments();
  const navReady = !!useRootNavigationState()?.key;
  const previous = useRef(uid);
  const lastPush = useLastPushResponse();

  // Ask for push permission once there's a finished profile to send Cheers and comments to.
  const onboardedId = me?.onboarded ? me.id : null;
  useEffect(() => {
    if (onboardedId) void registerForPush();
  }, [onboardedId]);

  // A push arriving while the app is open: refresh Alerts so the tab dot shows it.
  useEffect(() => watchIncomingPushes(() => queryClient.invalidateQueries({ queryKey: ['notifications'] })), []);

  // A tapped push (including the one that launched the app) opens what it's about.
  useEffect(() => {
    if (navReady && lastPush) openPush(lastPush);
  }, [navReady, lastPush]);

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
