import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';

/** Look for a new update at most this often when the app comes back to the foreground. */
const CHECK_EVERY_MS = 30 * 60_000;

const enabled = Updates.isEnabled && !__DEV__;

/**
 * Over-the-air updates (GP-044). The app already downloads a published update on launch; this
 * also checks when it returns to the foreground, and once an update has downloaded, offers to
 * restart into it instead of waiting for the next cold start.
 */
export function UpdatePrompt() {
  return enabled ? <Watcher /> : null;
}

function Watcher() {
  const { isUpdatePending } = Updates.useUpdates();
  const lastCheck = useRef(0);
  const offered = useRef(false);

  useEffect(() => {
    const check = async () => {
      if (Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Offline or the update server is unreachable; try again next time.
      }
    };
    void check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void check());
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!isUpdatePending || offered.current) return;
    offered.current = true;
    Alert.alert('GamePulse updated', 'A new version is ready. Restart to get the latest fixes and features.', [
      { text: 'Later', style: 'cancel' },
      { text: 'Restart now', onPress: () => void Updates.reloadAsync() },
    ]);
  }, [isUpdatePending]);

  return null;
}
