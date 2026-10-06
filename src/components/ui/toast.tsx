import { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './app-text';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Toast = { id: number; title: string; message?: string; emoji?: string };

let current: Toast | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const set = (next: Toast | null) => {
  current = next;
  listeners.forEach((l) => l());
};

/** A short message that slides in at the top and goes away on its own. One at a time. */
export const toast = {
  show: (t: Omit<Toast, 'id'>) => set({ ...t, id: ++seq }),
};

const VISIBLE_MS = 3200;

/** Rendered once in the root layout. */
export function ToastHost() {
  const t = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!t) return;
    const timer = setTimeout(() => current?.id === t.id && set(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [t]);

  // The wrapper stays mounted so the toast's exit animation can play.
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + Spacing.two }]}>
      {t && (
      <Animated.View
        key={t.id}
        entering={FadeInUp.springify().damping(16)}
        exiting={FadeOutUp}
        accessibilityLiveRegion="polite"
        style={styles.toast}>
        {t.emoji && <AppText style={styles.emoji}>{t.emoji}</AppText>}
        <View style={styles.text}>
          <AppText variant="bodyBold" color={Colors.iceWhite}>
            {t.title}
          </AppText>
          {t.message && (
            <AppText variant="caption" color={Colors.powderBlue}>
              {t.message}
            </AppText>
          )}
        </View>
      </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.three, right: Spacing.three, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    maxWidth: 440,
    paddingVertical: Spacing.two + 4,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDeep,
    borderWidth: 1,
    borderColor: 'rgba(198, 255, 61, 0.35)',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
  },
  emoji: { fontSize: 26, lineHeight: 32 },
  text: { flexShrink: 1, gap: 1 },
});
