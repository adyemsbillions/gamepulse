import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReelFeed } from '@/components/reels/reel-feed';
import { Colors, Spacing } from '@/constants/theme';
import { getFeed } from '@/lib/api';

/** Full-screen feed scoped to a hashtag or creator, opened from a grid. */
export default function ScopedFeed() {
  const insets = useSafeAreaInsets();
  const { hashtag, username, start } = useLocalSearchParams<{
    hashtag?: string;
    username?: string;
    start?: string;
  }>();

  const reels = useMemo(() => getFeed({ hashtag, username }), [hashtag, username]);
  const initialIndex = Math.max(0, reels.findIndex((r) => r.id === start));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ReelFeed reels={reels} initialIndex={initialIndex} topInset={insets.top} bottomInset={insets.bottom} />
      <Pressable
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={() => router.back()}
        style={[styles.back, { top: insets.top + Spacing.two }]}>
        <ChevronLeft size={26} color={Colors.iceWhite} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryDeep },
  back: {
    position: 'absolute',
    left: Spacing.three,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.scrim,
  },
});
