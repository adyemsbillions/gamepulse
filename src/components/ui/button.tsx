import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './app-text';

import { Colors, Radius, Spacing } from '@/constants/theme';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
  disabled?: boolean;
  labelColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  labelColor,
  style,
}: Props) {
  const fg = labelColor ?? (variant === 'primary' ? Colors.textOnBrand : Colors.primary);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.8 },
        style,
      ]}>
      {icon}
      <AppText variant="bodyBold" color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.pill,
  },
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.surfaceMuted },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
});
