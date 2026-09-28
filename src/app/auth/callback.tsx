import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { LoadingView } from '@/components/ui/states';
import { completeSignIn } from '@/lib/auth';

/**
 * gamepulse://auth/callback — where Google sign-in returns. The sign-in sheet normally handles it;
 * this screen covers the case where Android also opens the link in the app.
 */
export default function AuthCallback() {
  const { code, error, error_description: description } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();

  useEffect(() => {
    const qs = new URLSearchParams();
    if (code) qs.set('code', code);
    if (error) qs.set('error', error);
    if (description) qs.set('error_description', description);
    completeSignIn(`gamepulse://auth/callback?${qs.toString()}`)
      .catch(() => {})
      .finally(() => router.replace('/'));
  }, [code, error, description]);

  return <LoadingView dark />;
}
