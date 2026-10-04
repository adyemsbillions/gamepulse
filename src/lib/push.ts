/**
 * Push notifications (GP-017).
 *
 * Every row in `notifications` is also pushed to the recipient's phones: a database trigger calls
 * the `push` Edge Function, which sends through Expo's push service. This file registers the
 * device (permission → Expo push token → `push_tokens`), and opens the right screen when a push
 * is tapped. Web and sample mode don't register.
 */
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { data, isLive } from './api';

const enabled = Platform.OS !== 'web' && isLive;

/** Android channel every push is posted to; keep in step with `defaultChannel` in app.json. */
export const PUSH_CHANNEL = 'default';

if (enabled) {
  // Show pushes as a banner even while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

let registeredToken: string | null = null;

/**
 * Ask for permission (Android 13+ and iOS show a prompt once) and send this device's token to the
 * server. Safe to call repeatedly; never throws.
 */
export async function registerForPush(): Promise<void> {
  if (!enabled) return;
  try {
    if (Platform.OS === 'android') {
      // Android shows the permission prompt only once a channel exists.
      await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
        name: 'Cheers, comments and Fans',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 120, 180],
        lightColor: '#C6FF3D',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await data.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
    registeredToken = token;
  } catch (e) {
    // Most often: no Firebase config in this build yet (google-services.json), or offline.
    console.warn('Push notifications unavailable:', e instanceof Error ? e.message : e);
  }
}

/** Stop this device getting the current user's pushes. Call before signing out. */
export async function unregisterFromPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (token) await data.unregisterPushToken(token).catch(() => {});
}

/** Open what a tapped push is about. Payload comes from the `push` Edge Function. */
export function openPush(response: Notifications.NotificationResponse) {
  if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const payload = response.notification.request.content.data ?? {};
  const reelId = typeof payload.reelId === 'string' ? payload.reelId : null;
  const username = typeof payload.actorUsername === 'string' ? payload.actorUsername : null;

  if (reelId) router.push(`/comments/${reelId}`);
  else if (username) router.push(`/user/${username}`);
  else router.push('/notifications');
  // So the same tap isn't handled again when the root remounts.
  Notifications.clearLastNotificationResponse();
}

export const useLastPushResponse = enabled ? Notifications.useLastNotificationResponse : () => undefined;

/** Run `onPush` whenever a push arrives while the app is open. Returns an unsubscribe. */
export function watchIncomingPushes(onPush: () => void): () => void {
  if (!enabled) return () => {};
  const sub = Notifications.addNotificationReceivedListener(onPush);
  return () => sub.remove();
}
