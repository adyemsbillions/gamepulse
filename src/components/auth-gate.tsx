import { router, useRootNavigationState, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { toast } from '@/components/ui/toast';
import { data } from '@/lib/api';
import { engagement } from '@/lib/engagement-store';
import { openPush, registerForPush, useLastPushResponse, watchIncomingPushes } from '@/lib/push';
import { queryClient, useMe } from '@/lib/queries';
import { useSessionUserId } from '@/lib/session';

let checkedInOn = '';

/** Once per calendar day on this device; the server decides the streak and the points. */
async function dailyCheckIn() {
  const today = new Date().toDateString();
  if (checkedInOn === today) return;
  checkedInOn = today;
  try {
    const result = await data.checkIn();
    if (!result || result.awarded <= 0) return;
    toast.show(
      result.streak > 1
        ? {
            emoji: '🔥',
            title: `${result.streak}-day streak!`,
            message: `+${result.awarded} Pulse${result.usedPass ? ' · your weekly pass saved it' : ''}`,
          }
        : { emoji: '⚡', title: `+${result.awarded} Pulse`, message: 'Come back tomorrow to start a streak.' },
    );
    queryClient.invalidateQueries({ queryKey: ['me'] });
    queryClient.invalidateQueries({ queryKey: ['pulse'] });
  } catch {
    checkedInOn = ''; // try again next time the app comes to the front
  }
}

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

  // Daily check-in: on open, and when the app comes back on a new day. Keeps the streak going.
  useEffect(() => {
    if (!onboardedId) return;
    void dailyCheckIn();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void dailyCheckIn());
    return () => sub.remove();
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
    checkedInOn = ''; // a different account gets its own check-in today
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
