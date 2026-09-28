import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';

import { Colors, Fonts } from '@/constants/theme';
import type { User } from '@/lib/types';

const palette = [Colors.royalBlue, '#1F4FA8', '#3A6BC4', '#274690', '#0B5563'];

/** Initials avatar until profile photos are uploaded to storage. */
export function Avatar({ user, size = 40, ring }: { user: User; size?: number; ring?: string }) {
  const bg = palette[user.id.charCodeAt(user.id.length - 1) % palette.length];
  const initials = user.displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        ring ? { borderWidth: 2, borderColor: ring } : null,
      ]}>
      <AppText
        color={Colors.iceWhite}
        style={{ fontFamily: Fonts.semibold, fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {initials}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});
