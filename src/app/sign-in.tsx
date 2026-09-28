import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { LogoMark, Wordmark } from '@/components/brand/logo';
import { AppText } from '@/components/ui/app-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { isLive } from '@/lib/api';
import { signInWithGoogle } from '@/lib/auth';

/** Sign-in sheet. Opened from Profile, Alerts, comments, or any action that needs an account. */
export default function SignIn() {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (!mounted.current) return;
      if (result === 'signed-in' && router.canGoBack()) router.back();
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Sign-in failed. Try again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="signInBg" cx="50%" cy="30%" r="80%">
            <Stop offset="0" stopColor="#1B4AA8" />
            <Stop offset="0.55" stopColor={Colors.royalBlue} />
            <Stop offset="1" stopColor={Colors.primaryDeep} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#signInBg)" />
      </Svg>

      <Pressable
        accessibilityLabel="Close"
        hitSlop={12}
        onPress={() => router.back()}
        style={[styles.close, { top: insets.top + Spacing.two }]}>
        <X size={24} color={Colors.iceWhite} />
      </Pressable>

      <View style={styles.hero}>
        <LogoMark width={210} />
        <Wordmark size={30} />
        <AppText style={styles.headline} color={Colors.iceWhite}>
          Every Moment has a pulse.
        </AppText>
        <AppText color={Colors.powderBlue} style={styles.sub}>
          Sign in to cheer, comment, support GameMakers and post your own football Moments.
        </AppText>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.four }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          disabled={busy || !isLive}
          onPress={google}
          style={({ pressed }) => [styles.google, (pressed || busy) && styles.pressed, !isLive && styles.disabled]}>
          {busy ? (
            <ActivityIndicator color={Colors.royalBlue} />
          ) : (
            <AppText style={styles.googleLabel} color={Colors.primaryDeep}>
              Continue with Google
            </AppText>
          )}
        </Pressable>

        {!isLive && (
          <AppText variant="caption" color={Colors.powderBlue} style={styles.note}>
            You&apos;re on sample data. Add .env.local with your Supabase keys and rebuild to sign in.
          </AppText>
        )}
        {error && (
          <AppText variant="caption" color="#FFB4B4" style={styles.note}>
            {error}
          </AppText>
        )}
        <AppText variant="caption" color={Colors.powderBlue} style={styles.legal}>
          By continuing you agree to the GamePulse Terms and Privacy Policy.
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.royalBlue },
  close: {
    position: 'absolute',
    right: Spacing.three,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four, gap: Spacing.three },
  headline: { fontFamily: Fonts.bold, fontSize: 22, lineHeight: 28, marginTop: Spacing.four, textAlign: 'center' },
  sub: { textAlign: 'center', maxWidth: 320 },
  actions: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  google: {
    height: 54,
    borderRadius: Radius.pill,
    backgroundColor: Colors.iceWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLabel: { fontFamily: Fonts.semibold, fontSize: 16 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  note: { textAlign: 'center' },
  legal: { textAlign: 'center', opacity: 0.8 },
});
