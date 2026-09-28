import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PulseBall } from '@/components/brand/pulse-ball';
import { AppText } from '@/components/ui/app-text';
import { Colors } from '@/constants/theme';
import { engagement } from '@/lib/engagement-store';
import { formatCount } from '@/lib/format';
import type { Reel } from '@/lib/types';

const SIZE = 34;

/** Pulse ring frame for progress t (0 → 1). Hidden at rest (t = 1). */
function ringFrame(t: number) {
  'worklet';
  return {
    opacity: t >= 1 ? 0 : (1 - t) * 0.9,
    transform: [{ scale: 0.8 + t * 1.3 }],
  };
}

/**
 * Cheer = a pulse. The ball gets kicked (squash → pop → spin → bounce), two pulse rings fire off
 * it and a +1 floats up. Also plays when a Cheer arrives from a double-tap on the video.
 */
export function CheerButton({ reel, active, count }: { reel: Reel; active: boolean; count: number }) {
  const reduceMotion = useReducedMotion();
  const wasActive = useRef(active);

  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  const spin = useSharedValue(0);
  const ringA = useSharedValue(1);
  const ringB = useSharedValue(1);
  const plus = useSharedValue(1);

  useEffect(() => {
    const was = wasActive.current;
    wasActive.current = active;
    if (was === active || reduceMotion) return;

    if (!active) {
      scale.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 12 }));
      return;
    }

    scale.value = withSequence(
      withTiming(0.7, { duration: 80 }),
      withSpring(1.22, { damping: 6, stiffness: 320 }),
      withSpring(1, { damping: 10 }),
    );
    lift.value = withSequence(
      withTiming(-16, { duration: 170, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 420, easing: Easing.bounce }),
    );
    spin.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(360, { duration: 650, easing: Easing.out(Easing.cubic) }),
    );
    ringA.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) }),
    );
    ringB.value = withSequence(
      withTiming(0, { duration: 0 }),
      withDelay(150, withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) })),
    );
    plus.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 760 }));
    // Shared values are stable refs; only the `active` transition should replay the kick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduceMotion]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }, { rotate: `${spin.value}deg` }],
  }));
  const ringAStyle = useAnimatedStyle(() => ringFrame(ringA.value));
  const ringBStyle = useAnimatedStyle(() => ringFrame(ringB.value));
  const plusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(plus.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
    transform: [{ translateY: interpolate(plus.value, [0, 1], [0, -34]) }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={active ? 'Remove cheer' : 'Cheer'}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      onPress={() => engagement.cheer(reel, active)}
      style={styles.action}>
      <View style={styles.stage}>
        <Animated.View pointerEvents="none" style={[styles.ring, ringAStyle]} />
        <Animated.View pointerEvents="none" style={[styles.ring, ringBStyle]} />
        <Animated.View style={ballStyle}>
          {active ? (
            <PulseBall size={SIZE} body={Colors.pulse} panel={Colors.primaryDeep} />
          ) : (
            <PulseBall size={SIZE} body="transparent" panel={Colors.iceWhite} />
          )}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.plus, plusStyle]}>
          <AppText variant="bodyBold" color={Colors.pulse} style={styles.textShadow}>
            +1
          </AppText>
        </Animated.View>
      </View>
      <AppText variant="label" color={active ? Colors.pulse : Colors.iceWhite} style={styles.textShadow}>
        {formatCount(count)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { alignItems: 'center', gap: 2 },
  stage: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    borderColor: Colors.pulse,
  },
  plus: { position: 'absolute', top: -18, right: -16 },
  textShadow: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
