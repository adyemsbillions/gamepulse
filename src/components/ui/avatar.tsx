import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';

import { Colors, Fonts } from '@/constants/theme';
import type { User } from '@/lib/types';

const palette = [Colors.royalBlue, '#1F4FA8', '#3A6BC4', '#274690', '#0B5563'];

/** Profile photo when there is one (e.g. from Google), otherwise initials on a brand colour. */
export function Avatar({ user, size = 40, ring }: { user: User; size?: number; ring?: string }) {
  const bg = palette[user.id.charCodeAt(user.id.length - 1) % palette.length];
  const initials = (user.displayName || user.username)
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
      {user.avatarUrl ? (
        <Image
          source={user.avatarUrl}
          style={{ width: '100%', height: '100%', borderRadius: size / 2 }}
          contentFit="cover"
          transition={120}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <AppText
          color={Colors.iceWhite}
          style={{ fontFamily: Fonts.semibold, fontSize: size * 0.38, lineHeight: size * 0.5 }}>
          {initials}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
