import { completeSignIn, isAuthCallback } from '@/lib/auth';

/**
 * Runs on every link that opens the app, before Expo Router picks a screen.
 *
 * Google sign-in returns to gamepulse://auth/callback?code=… . We finish signing in right here
 * and send the user to the home screen, so the return link never depends on a route matching
 * (the sign-in sheet and the auth gate take it from there).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (isAuthCallback(path)) {
      const query = path.includes('?') ? path.slice(path.indexOf('?')) : '';
      completeSignIn(`gamepulse://auth/callback${query}`).catch(() => {});
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
