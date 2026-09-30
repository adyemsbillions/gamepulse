import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Colors, Spacing } from '@/constants/theme';
import type { FeedFilter } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { imageSource } from '@/lib/media';
import type { Reel } from '@/lib/types';

const GAP = 2;

/** 3-column poster grid. Tapping opens the vertical feed scoped to the same list. */
export function ReelGrid({ reels, filter = {} }: { reels: Reel[]; filter?: FeedFilter }) {
  const cellWidth = Math.floor((useWindowDimensions().width - GAP * 2) / 3);
  return (
    <View style={styles.grid}>
      {reels.map((reel) => (
        <Pressable
          key={reel.id}
          accessibilityLabel={reel.caption}
          style={[styles.cell, { width: cellWidth }]}
          onPress={() => router.push({ pathname: '/feed', params: { ...filter, start: reel.id } })}>
          <Image source={imageSource(reel.thumbnailUrl)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          <View style={styles.views}>
            <Play size={12} color={Colors.iceWhite} fill={Colors.iceWhite} />
            <AppText variant="label" color={Colors.iceWhite}>
              {formatCount(reel.views)}
            </AppText>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: {
    aspectRatio: 9 / 16,
    backgroundColor: Colors.surfaceMuted,
  },
  views: {
    position: 'absolute',
    left: Spacing.one + 2,
    bottom: Spacing.one + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
