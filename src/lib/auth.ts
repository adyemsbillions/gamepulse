/**
 * Google sign-in through Supabase (GP-012).
 *
 * Flow: Supabase gives us Google's sign-in page URL → we open it in a secure in-app browser →
 * Google sends the user back to gamepulse://auth/callback with a one-time code → we swap the code
 * for a Supabase session, which is saved on the device and refreshed automatically.
 */
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { getSessionUserId } from './session';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export const AUTH_CALLBACK_PATH = 'auth/callback';

export type SignInResult = 'signed-in' | 'cancelled';

export async function signInWithGoogle(): Promise<SignInResult> {
  if (!supabase) throw new Error('Sign-in needs a Supabase project. Add .env.local and rebuild.');

  const redirectTo = Linking.createURL(AUTH_CALLBACK_PATH);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data?.url) throw new Error(error?.message ?? 'Could not start Google sign-in.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';

  await completeSignIn(result.url);
  return 'signed-in';
}

/**
 * Turn the callback URL into a session. Handles the PKCE code (`?code=`) and, for older links,
 * tokens in the fragment. Safe to call twice with the same URL.
 */
export async function completeSignIn(url: string) {
  if (!supabase) return;
  const params = paramsFrom(url);
  if (params.error) throw new Error(params.error_description ?? params.error);

  if (params.code) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return; // already exchanged (the deep link can arrive twice on Android)
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      // The other copy of the deep link may have exchanged the code first.
      const again = await supabase.auth.getSession();
      if (!again.data.session) throw new Error(error.message);
    }
  } else if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) throw new Error(error.message);
  }
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/**
 * For actions that need an account (cheer, comment, support, post…). Returns true when signed
 * in; otherwise opens the sign-in sheet and returns false.
 */
export function requireSignIn(): boolean {
  if (getSessionUserId()) return true;
  router.push('/sign-in');
  return false;
}

function paramsFrom(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const [, query = ''] = url.split('?');
  const [queryPart, hash = ''] = query.split('#');
  const fragment = url.includes('#') ? url.slice(url.indexOf('#') + 1) : hash;
  for (const part of [queryPart, fragment]) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return out;
}
