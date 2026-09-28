import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from './app-text';
import { Button } from './button';

import { PulseBall } from '@/components/brand/pulse-ball';
import { Colors, Spacing } from '@/constants/theme';

/** Loading indicator: the pulse ball beating (lub-dub, rest). */
export function PulseLoader({ size = 34, dark = false }: { size?: number; dark?: boolean }) {
  const reduceMotion = useReducedMotion();
  const beat = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    beat.value = withRepeat(
      withSequence(
        withTiming(1.16, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(0.96, { duration: 110 }),
        withTiming(1.1, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 160 }),
        withTiming(1, { duration: 420 }),
      ),
      -1,
    );
  }, [beat, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));

  return (
    <Animated.View style={style} accessibilityRole="progressbar" accessibilityLabel="Loading">
      {dark ? (
        <PulseBall size={size} body={Colors.pulse} panel={Colors.primaryDeep} />
      ) : (
        <PulseBall size={size} body={Colors.primary} panel={Colors.iceWhite} />
      )}
    </Animated.View>
  );
}

type StateProps = { dark?: boolean; style?: StyleProp<ViewStyle> };

export function LoadingView({ dark, style }: StateProps) {
  return (
    <View style={[styles.center, dark && styles.dark, style]}>
      <PulseLoader dark={dark} />
    </View>
  );
}

export function ErrorView({
  message = "Couldn't load this. Check your connection.",
  onRetry,
  dark,
  style,
}: StateProps & { message?: string; onRetry?: () => void }) {
  return (
    <View style={[styles.center, dark && styles.dark, style]}>
      <AppText color={dark ? Colors.powderBlue : Colors.textSecondary} style={styles.text}>
        {message}
      </AppText>
      {onRetry && (
        <Button
          label="Try again"
          variant={dark ? 'ghost' : 'secondary'}
          labelColor={dark ? Colors.iceWhite : undefined}
          onPress={onRetry}
        />
      )}
    </View>
  );
}

export function EmptyView({ message, dark, style }: StateProps & { message: string }) {
  return (
    <View style={[styles.center, dark && styles.dark, style]}>
      <AppText color={dark ? Colors.powderBlue : Colors.textSecondary} style={styles.text}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five, gap: Spacing.three },
  dark: { backgroundColor: Colors.primaryDeep },
  text: { textAlign: 'center' },
});
