import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { PulseTrace } from '@/components/brand/logo';
import { PulseBall } from '@/components/brand/pulse-ball';
import { Colors } from '@/constants/theme';

/** `tilt` (deg) is randomised per tap so repeated bursts don't look stamped. */
export type Burst = { id: number; x: number; y: number; tilt: number };

const BALL = 96;
const BOX = 280;
const DROP = 460; // ms until the ball lands
export const BURST_MS = 1250;

/** Impact ring frame: `p` is shared progress, `delay` staggers each ring within it. */
function ringFrame(p: number, delay: number) {
  'worklet';
  const t = Math.min(Math.max((p - delay) / (1 - delay), 0), 1);
  return {
    opacity: t <= 0 || t >= 1 ? 0 : (1 - t) * 0.95,
    transform: [{ scale: 0.55 + t * 1.9 }],
  };
}

/** Layer that renders every live double-tap burst. Each one removes itself when it's done. */
export function CheerBursts({ bursts }: { bursts: Burst[] }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((b) => (
        <CheerBurst key={b.id} x={b.x} y={b.y} tilt={b.tilt} />
      ))}
    </View>
  );
}

/**
 * Double-tap Cheer: the ball drops onto the tap point and bounces, the landing sends out pulse
 * rings and a heartbeat trace sweeps through it, then it pops back up and away.
 */
function CheerBurst({ x, y, tilt }: { x: number; y: number; tilt: number }) {
  const fall = useSharedValue(0); // 0 = above, 1 = landed
  const spin = useSharedValue(-140);
  const trace = useSharedValue(0);
  const rings = useSharedValue(0);
  const out = useSharedValue(0);

  useEffect(() => {
    fall.value = withTiming(1, { duration: DROP, easing: Easing.bounce });
    spin.value = withTiming(0, { duration: DROP + 120, easing: Easing.out(Easing.cubic) });
    trace.value = withDelay(DROP * 0.55, withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }));
    rings.value = withDelay(DROP * 0.5, withTiming(1, { duration: 760, easing: Easing.out(Easing.quad) }));
    out.value = withDelay(BURST_MS - 330, withTiming(1, { duration: 330, easing: Easing.in(Easing.back(2)) }));
  }, [fall, spin, trace, rings, out]);

  const ballStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fall.value, [0, 0.15], [0, 1], 'clamp') * (1 - out.value),
    transform: [
      { translateY: interpolate(fall.value, [0, 1], [-150, 0]) - out.value * 90 },
      { scale: interpolate(fall.value, [0, 1], [0.6, 1]) * (1 + out.value * 0.25) },
      { rotate: `${spin.value + tilt}deg` },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: fall.value * 0.45 * (1 - out.value),
    transform: [{ scaleX: 0.4 + fall.value * 0.6 - out.value * 0.4 }],
  }));

  const traceStyle = useAnimatedStyle(() => ({
    width: BOX * trace.value,
    opacity: interpolate(trace.value, [0, 0.1, 0.75, 1], [0, 1, 1, 0]),
  }));

  // Read `rings.value` directly in each updater so Reanimated subscribes to it.
  const ring1 = useAnimatedStyle(() => ringFrame(rings.value, 0));
  const ring2 = useAnimatedStyle(() => ringFrame(rings.value, 0.14));
  const ring3 = useAnimatedStyle(() => ringFrame(rings.value, 0.28));

  return (
    <View style={[styles.box, { left: x - BOX / 2, top: y - BOX / 2 }]}>
      <Animated.View style={[styles.trace, traceStyle]}>
        <PulseTrace width={BOX} />
      </Animated.View>

      <Animated.View style={[styles.ring, ring1]} />
      <Animated.View style={[styles.ring, styles.ringThin, ring2]} />
      <Animated.View style={[styles.ring, styles.ringFaint, ring3]} />

      <Animated.View style={[styles.shadow, shadowStyle]} />
      <Animated.View style={ballStyle}>
        <PulseBall size={BALL} body={Colors.pulse} panel={Colors.primaryDeep} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    width: BOX,
    height: BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trace: {
    position: 'absolute',
    left: 0,
    height: BOX * 0.52,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: BALL,
    height: BALL,
    borderRadius: BALL / 2,
    borderWidth: 4,
    borderColor: Colors.pulse,
  },
  ringThin: { borderWidth: 2.5 },
  ringFaint: { borderWidth: 1.5 },
  shadow: {
    position: 'absolute',
    top: BOX / 2 + BALL / 2 - 4,
    width: BALL * 0.8,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000',
  },
});
