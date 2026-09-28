/**
 * GamePulse design tokens.
 * Brand: Ice White #F4FEFF, Powder Blue #A9C0E0, Royal Blue #0E2F76.
 */

export const Brand = {
  iceWhite: '#F4FEFF',
  powderBlue: '#A9C0E0',
  royalBlue: '#0E2F76',
} as const;

export const Colors = {
  ...Brand,
  background: Brand.iceWhite,
  surface: '#FFFFFF',
  surfaceMuted: '#E6EEF8',
  border: '#D3DFEE',
  text: '#0B1B3F',
  textSecondary: '#5B6B8A',
  textOnBrand: Brand.iceWhite,
  primary: Brand.royalBlue,
  primaryDeep: '#081D4D',
  /** Pulse Volt — the "pulse" accent: Cheers, live moments, the ECG trace in the logo. */
  pulse: '#C6FF3D',
  /** Cheers are pulses. Reads on dark/video surfaces; on light surfaces use `primary`. */
  cheer: '#C6FF3D',
  /** Trending / "Hot Now" flame. */
  hot: '#FF6B2C',
  danger: '#D64545',
  /** Surfaces drawn over video. */
  overlay: 'rgba(8, 29, 77, 0.35)',
  scrim: 'rgba(0, 0, 0, 0.45)',
} as const;

/**
 * COUTURE (display) and Delight (accent) are not bundled yet — drop the font files in
 * `assets/fonts/`, register them in `src/app/_layout.tsx`, and point `display`/`accent` here.
 */
export const Fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  display: 'Poppins_800ExtraBold',
  accent: 'Poppins_600SemiBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export const TabBarHeight = 64;
