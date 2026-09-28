import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyBold' | 'caption' | 'label';

export type AppTextProps = TextProps & {
  variant?: Variant;
  color?: string;
};

export function AppText({ variant = 'body', color = Colors.text, style, ...rest }: AppTextProps) {
  return <Text {...rest} style={[styles[variant], { color }, style]} />;
}

const styles = StyleSheet.create({
  display: { fontFamily: Fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: 1 },
  title: { fontFamily: Fonts.bold, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: Fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyBold: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 21 },
  caption: { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: Fonts.medium, fontSize: 12, lineHeight: 16 },
});
