import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

/**
 * GamePulse's own sticker pack. Drawn, not images: crisp at any size and nothing to download.
 * A comment stores `gp:<id>`; unknown ids (e.g. from a newer app version) show a plain ball.
 */
export type StickerDef = { id: string; emoji: string; label: string; bg: string; fg: string };

export const STICKERS: readonly StickerDef[] = [
  { id: 'goal', emoji: '⚽', label: 'GOAL!', bg: Colors.pulse, fg: Colors.primaryDeep },
  { id: 'golazo', emoji: '🔥', label: 'GOLAZO', bg: '#FF3B30', fg: '#FFFFFF' },
  { id: 'siuuu', emoji: '🙌', label: 'SIUUU', bg: Colors.royalBlue, fg: Colors.iceWhite },
  { id: 'topbins', emoji: '🎯', label: 'TOP BINS', bg: Colors.hot, fg: '#FFFFFF' },
  { id: 'goat', emoji: '🐐', label: 'G.O.A.T', bg: Colors.iceWhite, fg: Colors.primaryDeep },
  { id: 'nutmegged', emoji: '🫣', label: 'NUTMEGGED', bg: '#FF2D55', fg: '#FFFFFF' },
  { id: 'nawao', emoji: '😮', label: 'NA WA O', bg: '#8E44AD', fg: '#FFFFFF' },
  { id: 'wahala', emoji: '😬', label: 'WAHALA', bg: '#E63946', fg: '#FFFFFF' },
  { id: 'balldonland', emoji: '🛬', label: 'BALL DON LAND', bg: Colors.pulse, fg: Colors.primaryDeep },
  { id: 'offside', emoji: '🚩', label: 'OFFSIDE!', bg: '#FFD60A', fg: Colors.primaryDeep },
  { id: 'var', emoji: '📺', label: 'VAR CHECK', bg: '#1C1C1E', fg: Colors.pulse },
  { id: 'redcard', emoji: '🟥', label: 'RED CARD', bg: '#D62828', fg: '#FFFFFF' },
  { id: 'ref', emoji: '😤', label: 'REF!!', bg: '#FF9F0A', fg: Colors.primaryDeep },
  { id: 'clean', emoji: '🧼', label: 'CLEAN!', bg: '#34C759', fg: '#FFFFFF' },
  { id: 'skills', emoji: '🌀', label: 'SKILLS', bg: '#5E5CE6', fg: '#FFFFFF' },
  { id: 'ewo', emoji: '🙆', label: 'EWO!', bg: '#0A84FF', fg: '#FFFFFF' },
  { id: 'champions', emoji: '🏆', label: 'CHAMPIONS', bg: '#F5C518', fg: Colors.primaryDeep },
  { id: 'pulse', emoji: '⚡', label: 'PULSE!', bg: Colors.primaryDeep, fg: Colors.pulse },
];

const byId = new Map(STICKERS.map((s) => [s.id, s]));

/** 'gp:goal' → the goal sticker (or null if it isn't one of ours). */
export const stickerFor = (url: string) => (url.startsWith('gp:') ? (byId.get(url.slice(3)) ?? null) : null);

/** A small, fixed tilt per sticker so a row of them looks hand-placed rather than stamped. */
const tilt = (id: string) => ((id.charCodeAt(0) + id.length * 7) % 13) - 6;

export function Sticker({ id, size = 96 }: { id: string; size?: number }) {
  const s = byId.get(id) ?? { id, emoji: '⚽', label: '', bg: Colors.surfaceMuted, fg: Colors.primary };
  const long = s.label.length > 8;
  return (
    <View
      accessibilityLabel={s.label ? `${s.label} sticker` : 'Sticker'}
      style={[
        styles.sticker,
        {
          width: size,
          minHeight: size * 0.82,
          backgroundColor: s.bg,
          borderRadius: size * 0.2,
          borderWidth: Math.max(2, size * 0.04),
          transform: [{ rotate: `${tilt(s.id)}deg` }],
        },
      ]}>
      <Text style={{ fontSize: size * 0.34, lineHeight: size * 0.42 }}>{s.emoji}</Text>
      {!!s.label && (
        <Text
          numberOfLines={2}
          adjustsFontSizeToFit
          style={[styles.label, { color: s.fg, fontSize: size * (long ? 0.12 : 0.16), lineHeight: size * (long ? 0.15 : 0.2) }]}>
          {s.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sticker: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderColor: '#FFFFFF',
    boxShadow: '0 3px 8px rgba(8, 29, 77, 0.25)',
  },
  label: { fontFamily: Fonts.display, textAlign: 'center', letterSpacing: 0.5 },
});
