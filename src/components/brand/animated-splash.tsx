import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { LOCKUP } from './geometry';
import { LOCKUP_ASPECT, lockupUnit, PulseArcs, PulseTrace, Wordmark } from './logo';
import { PulseBall } from './pulse-ball';

import { AppText } from '@/components/ui/app-text';
import { Colors, Fonts } from '@/constants/theme';

/** Must match `imageWidth` of the expo-splash-screen plugin in app.json — it's the hand-off frame. */
const NATIVE_BALL_DP = 100;

const T = {
  beat: 0,
  kick: 480,
  kickDur: 540,
  arcs: 960,
  word: 1060,
  tag: 1220,
  exit: 2150,
  exitDur: 360,
};

const easeOut = Easing.out(Easing.cubic);

/**
 * Animated hand-off from the native splash: the ball beats twice (lub-dub), rolls right while
 * drawing the heartbeat trace behind it, pulse arcs fire, then the wordmark lands.
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const { width: screenW } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const hidNative = useRef(false);

  const LW = Math.min(screenW * 0.68, 270);
  const LH = LW * LOCKUP_ASPECT;
  const u = lockupUnit(LW);
  const vb = LOCKUP.viewBox;
  const ballSize = LOCKUP.ballR * 2 * u;
  const ballCX = (LOCKUP.ballX - vb.x) * u;
  const ballLeft = ballCX - ballSize / 2;
  const startDX = LW / 2 - ballCX; // ball starts dead centre, where the native splash drew it
  const startScale = NATIVE_BALL_DP / ballSize;
  const rollDeg = ((-startDX / (ballSize / 2)) * 180) / Math.PI;
  const revealW = (LOCKUP.traceEnd - vb.x) * u + LOCKUP.stroke * u;

  const bg = useSharedValue(0);
  const scale = useSharedValue(startScale);
  const dx = useSharedValue(startDX);
  const roll = useSharedValue(0);
  const reveal = useSharedValue(0);
  const arcs = useSharedValue(0);
  const echo = useSharedValue(0);
  const word = useSharedValue(0);
  const tag = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      bg.value = 1;
      scale.value = 1;
      dx.value = 0;
      reveal.value = 1;
      arcs.value = 1;
      word.value = 1;
      tag.value = 1;
      exit.value = withDelay(900, withTiming(1, { duration: 250 }));
      const t = setTimeout(onDone, 1200);
      return () => clearTimeout(t);
    }

    bg.value = withTiming(1, { duration: 600 });
    // lub-dub
    scale.value = withSequence(
      withTiming(startScale * 1.14, { duration: 110, easing: easeOut }),
      withTiming(startScale * 0.95, { duration: 100 }),
      withTiming(startScale * 1.08, { duration: 100, easing: easeOut }),
      withTiming(startScale, { duration: 150 }),
      withTiming(1, { duration: T.kickDur, easing: easeOut }),
    );
    // roll right, drawing the pulse behind it
    dx.value = withDelay(T.kick, withTiming(0, { duration: T.kickDur, easing: easeOut }));
    roll.value = withDelay(T.kick, withTiming(rollDeg, { duration: T.kickDur, easing: easeOut }));
    reveal.value = withDelay(T.kick, withTiming(1, { duration: T.kickDur, easing: easeOut }));
    arcs.value = withDelay(T.arcs, withSpring(1, { damping: 11, stiffness: 180 }));
    echo.value = withDelay(T.arcs, withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }));
    word.value = withDelay(T.word, withTiming(1, { duration: 380, easing: easeOut }));
    tag.value = withDelay(T.tag, withTiming(1, { duration: 380, easing: easeOut }));
    exit.value = withDelay(T.exit, withTiming(1, { duration: T.exitDur, easing: Easing.in(Easing.quad) }));

    const t = setTimeout(onDone, T.exit + T.exitDur + 40);
    return () => clearTimeout(t);
    // Runs once per mount; geometry is fixed for the splash's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const bgStyle = useAnimatedStyle(() => ({ opacity: bg.value }));
  const stageStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + exit.value * 0.08 }] }));
  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dx.value }, { scale: scale.value }, { rotate: `${roll.value}deg` }],
  }));
  const revealStyle = useAnimatedStyle(() => ({ width: revealW * reveal.value }));
  const arcsStyle = useAnimatedStyle(() => ({
    opacity: Math.min(arcs.value, 1),
    transform: [{ scale: 0.7 + arcs.value * 0.3 }],
  }));
  const echoStyle = useAnimatedStyle(() => ({
    opacity: echo.value === 0 ? 0 : (1 - echo.value) * 0.8,
    transform: [{ scale: 1 + echo.value * 1.6 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 14 }],
  }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tag.value,
    transform: [{ translateY: (1 - tag.value) * 10 }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      pointerEvents="none"
      onLayout={() => {
        if (hidNative.current) return;
        hidNative.current = true;
        SplashScreen.hide();
      }}>
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="gpSplashBg" cx="50%" cy="45%" r="75%">
              <Stop offset="0" stopColor="#1B4AA8" />
              <Stop offset="0.55" stopColor={Colors.royalBlue} />
              <Stop offset="1" stopColor={Colors.primaryDeep} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#gpSplashBg)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.stage, stageStyle]}>
        <View style={{ width: LW, height: LH }}>
          <Animated.View style={[styles.reveal, { height: LH }, revealStyle]}>
            <PulseTrace width={LW} />
          </Animated.View>

          <Animated.View
            style={[StyleSheet.absoluteFill, { transformOrigin: [ballCX, LH / 2, 0] }, arcsStyle]}>
            <PulseArcs width={LW} />
          </Animated.View>

          <Animated.View
            style={[
              styles.echo,
              {
                left: ballLeft,
                top: LH / 2 - ballSize / 2,
                width: ballSize,
                height: ballSize,
                borderRadius: ballSize / 2,
              },
              echoStyle,
            ]}
          />

          <Animated.View style={[{ position: 'absolute', left: ballLeft, top: LH / 2 - ballSize / 2 }, ballStyle]}>
            <PulseBall size={ballSize} />
          </Animated.View>

          {/* Absolutely placed so the lockup (and the ball) stay at true screen centre. */}
          <View style={[styles.words, { top: LH + 26 }]}>
            <Animated.View style={wordStyle}>
              <Wordmark size={Math.round(LW * 0.12)} />
            </Animated.View>
            <Animated.View style={tagStyle}>
              <AppText style={styles.tag} color={Colors.powderBlue}>
                FEEL EVERY MOMENT
              </AppText>
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: Colors.royalBlue, zIndex: 100 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reveal: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  echo: { position: 'absolute', borderWidth: 2, borderColor: Colors.pulse },
  words: { position: 'absolute', left: -120, right: -120, alignItems: 'center' },
  tag: { fontFamily: Fonts.semibold, fontSize: 11, letterSpacing: 3.5, marginTop: 6 },
});
