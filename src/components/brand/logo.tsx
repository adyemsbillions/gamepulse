import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { LOCKUP } from './geometry';
import { PulseBall } from './pulse-ball';

import { AppText } from '@/components/ui/app-text';
import { Colors, Fonts } from '@/constants/theme';

const VB = LOCKUP.viewBox;
export const LOCKUP_ASPECT = VB.h / VB.w;

/** Converts lockup units to dp for a lockup rendered `width` dp wide. */
export const lockupUnit = (width: number) => width / VB.w;

/** The ECG trace on its own, drawn in lockup space (so it lines up with <LogoMark />). */
export function PulseTrace({ width, color = Colors.pulse, glow = true }: { width: number; color?: string; glow?: boolean }) {
  return (
    <Svg width={width} height={width * LOCKUP_ASPECT} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}>
      {glow && (
        <Path
          d={LOCKUP.tracePath}
          fill="none"
          stroke={color}
          strokeOpacity={0.18}
          strokeWidth={LOCKUP.stroke * 2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <Path
        d={LOCKUP.tracePath}
        fill="none"
        stroke={color}
        strokeWidth={LOCKUP.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The two pulse arcs radiating off the ball, drawn in lockup space. */
export function PulseArcs({ width, color = Colors.pulse }: { width: number; color?: string }) {
  return (
    <Svg width={width} height={width * LOCKUP_ASPECT} viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}>
      <G fill="none" stroke={color} strokeLinecap="round">
        {LOCKUP.arcs.map((a) => (
          <Path key={a.d} d={a.d} strokeWidth={a.width} />
        ))}
      </G>
    </Svg>
  );
}

type LogoMarkProps = {
  width: number;
  pulseColor?: string;
  ballBody?: string;
  ballPanel?: string;
  glow?: boolean;
  arcs?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Pulse-ball lockup: heartbeat trace → football → pulse arcs. */
export function LogoMark({
  width,
  pulseColor = Colors.pulse,
  ballBody = Colors.iceWhite,
  ballPanel = Colors.royalBlue,
  glow = true,
  arcs = true,
  style,
}: LogoMarkProps) {
  const u = lockupUnit(width);
  const ballSize = LOCKUP.ballR * 2 * u;
  return (
    <View style={[{ width, height: width * LOCKUP_ASPECT }, style]}>
      <PulseTrace width={width} color={pulseColor} glow={glow} />
      {arcs && (
        <View style={StyleSheet.absoluteFill}>
          <PulseArcs width={width} color={pulseColor} />
        </View>
      )}
      <View
        style={{
          position: 'absolute',
          left: (LOCKUP.ballX - LOCKUP.ballR - VB.x) * u,
          top: (-LOCKUP.ballR - VB.y) * u,
        }}>
        <PulseBall size={ballSize} body={ballBody} panel={ballPanel} />
      </View>
    </View>
  );
}

/** Mark + GAMEPULSE wordmark, stacked. */
export function Logo({ width, color = Colors.iceWhite }: { width: number; color?: string }) {
  return (
    <View style={styles.stack}>
      <LogoMark width={width} />
      <Wordmark size={width * 0.13} color={color} />
    </View>
  );
}

export function Wordmark({ size, color = Colors.iceWhite }: { size: number; color?: string }) {
  return (
    <AppText style={[styles.word, { fontSize: size, lineHeight: size * 1.2, letterSpacing: size * 0.18 }]} color={color}>
      GAME<AppText style={[styles.word, { fontSize: size, color: Colors.pulse }]}>PULSE</AppText>
    </AppText>
  );
}

const styles = StyleSheet.create({
  stack: { alignItems: 'center', gap: 12 },
  word: { fontFamily: Fonts.display },
});
