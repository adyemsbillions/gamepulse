import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Line, Polygon } from 'react-native-svg';

import { BALL } from './geometry';

import { Colors } from '@/constants/theme';

export type PulseBallProps = {
  size: number;
  /** Ball leather. Pass 'transparent' for the outline style. */
  body?: string;
  /** Pentagon patches and seams. */
  panel?: string;
  /** Outer ring colour; defaults to `body` (or `panel` when the body is transparent). */
  rim?: string;
  /** Ring thickness in 100-unit box space. Thicker reads better at icon sizes. */
  rimWidth?: number;
};

/** The GamePulse football. Solid by default; pass `body="transparent"` for the outline icon. */
export function PulseBall({
  size,
  body = Colors.iceWhite,
  panel = Colors.royalBlue,
  rim,
  rimWidth,
}: PulseBallProps) {
  const clipId = `pb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const outline = body === 'transparent';
  const ring = rim ?? (outline ? panel : body);
  const rw = rimWidth ?? (outline ? 7 : BALL.seam);
  const c = BALL.box / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BALL.box} ${BALL.box}`}>
      <Defs>
        <ClipPath id={clipId}>
          <Circle cx={c} cy={c} r={BALL.radius} />
        </ClipPath>
      </Defs>
      {!outline && <Circle cx={c} cy={c} r={BALL.radius} fill={body} />}
      <G
        clipPath={`url(#${clipId})`}
        fill={panel}
        stroke={panel}
        strokeWidth={BALL.seam}
        strokeLinecap="round"
        strokeLinejoin="round">
        <Polygon points={BALL.center} />
        {BALL.patches.map((p, i) => (
          <Polygon key={`p${i}`} points={p} />
        ))}
        {BALL.seams.map((s, i) => (
          <Line key={`s${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
        ))}
      </G>
      <Circle cx={c} cy={c} r={BALL.radius - rw / 2} fill="none" stroke={ring} strokeWidth={rw} />
    </Svg>
  );
}
