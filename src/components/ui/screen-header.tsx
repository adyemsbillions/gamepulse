import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './app-text';

import { Colors, Spacing } from '@/constants/theme';

export function ScreenHeader({
  title,
  back,
  right,
}: {
  title: string;
  back?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      {back && (
        <Pressable accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()}>
          <ChevronLeft color={Colors.text} size={26} />
        </Pressable>
      )}
      <AppText variant="title" style={styles.title} numberOfLines={1}>
        {title}
      </AppText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  title: { flex: 1 },
});
