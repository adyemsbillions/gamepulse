/**
 * Supabase client. Configured from environment variables (see .env.example):
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY   (the "publishable" or legacy "anon" key — never the service key)
 * When they are missing, `supabase` is null and the app runs on bundled sample data.
 */
import 'react-native-url-polyfill/auto';
import './storage';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          // Undefined during web server rendering, where there is no session to keep.
          storage: typeof localStorage === 'undefined' ? undefined : localStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          // Google sign-in returns a one-time code to the app, exchanged here for a session.
          flowType: 'pkce',
        },
      })
    : null;

// Refresh the session only while the app is in the foreground (Supabase's React Native guidance).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
