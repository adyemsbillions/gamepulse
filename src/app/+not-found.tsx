import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/logo';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { LoadingView } from '@/components/ui/states';
import { Colors, Spacing } from '@/constants/theme';
import { completeSignIn } from '@/lib/auth';

/** Any link the app doesn't know. A stray sign-in return is finished here instead of failing. */
export default function NotFound() {
  const pathname = usePathname();
  const { code } = useGlobalSearchParams<{ code?: string }>();
  const isSignIn = !!code || pathname.includes('auth/callback');

  useEffect(() => {
    if (!isSignIn) return;
    completeSignIn(`gamepulse://auth/callback?code=${encodeURIComponent(code ?? '')}`)
      .catch(() => {})
      .finally(() => router.replace('/'));
  }, [isSignIn, code]);

  if (isSignIn) return <LoadingView dark />;

  return (
    <View style={styles.container}>
      <LogoMark width={150} />
      <AppText variant="title" color={Colors.iceWhite} style={styles.center}>
        This page is off the pitch
      </AppText>
      <AppText color={Colors.powderBlue} style={styles.center}>
        The link you followed doesn&apos;t lead anywhere in GamePulse.
      </AppText>
      <Button
        label="Back to Reels"
        labelColor={Colors.primaryDeep}
        onPress={() => router.replace('/')}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    backgroundColor: Colors.primaryDeep,
  },
  center: { textAlign: 'center' },
  cta: { marginTop: Spacing.two, minWidth: 200, backgroundColor: Colors.iceWhite },
});
