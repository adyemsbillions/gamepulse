import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Soft shading so white text stays readable over any video: a short fade at the top (feed
 * switcher, mute button) and a taller one at the bottom (name, caption, actions). Gradients, not
 * flat boxes, so there's no visible edge across the picture.
 */
export function VideoFades() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Fade id="reel-top" style={styles.top} stops={TOP} />
      <Fade id="reel-bottom" style={styles.bottom} stops={BOTTOM} />
    </View>
  );
}

/** [offset 0–1 from the top of the fade, opacity] */
type Stops = readonly (readonly [number, number])[];

// Eased (not linear) so the darkness builds gradually and never shows a line.
const TOP: Stops = [
  [0, 0.42],
  [0.45, 0.16],
  [1, 0],
];
const BOTTOM: Stops = [
  [0, 0],
  [0.35, 0.08],
  [0.65, 0.28],
  [1, 0.62],
];

function Fade({ id, style, stops }: { id: string; style: object; stops: Stops }) {
  return (
    <View style={style}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map(([offset, opacity]) => (
              <Stop key={offset} offset={offset} stopColor="#020A1F" stopOpacity={opacity} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, left: 0, right: 0, height: '18%' },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '42%' },
});
