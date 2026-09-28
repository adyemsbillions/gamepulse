import { useIsFocused } from 'expo-router';
import { Volume2, VolumeX } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from 'react-native';

import { ReelItem } from './reel-item';

import { AppText } from '@/components/ui/app-text';
import { Colors, Spacing } from '@/constants/theme';
import type { Reel } from '@/lib/types';

/** How many Reels either side of the active one get a live (buffering) player. */
const PRELOAD_RADIUS = 1;

type Props = {
  reels: Reel[];
  initialIndex?: number;
  /** Space reserved at the top for overlaid chrome (status bar, feed switcher). */
  topInset?: number;
  bottomInset?: number;
  emptyMessage?: string;
};

export function ReelFeed({
  reels,
  initialIndex = 0,
  topInset = 0,
  bottomInset = 0,
  emptyMessage = 'No Moments here yet.',
}: Props) {
  const focused = useIsFocused();
  const [height, setHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [pausedId, setPausedId] = useState<string | null>(null);
  // Browsers block unmuted autoplay, so web starts muted.
  const [muted, setMuted] = useState(Platform.OS === 'web');

  const onLayout = (e: LayoutChangeEvent) => setHeight(Math.round(e.nativeEvent.layout.height));

  // Must stay referentially stable — FlatList doesn't support swapping this callback.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Reel>[] }) => {
      const first = viewableItems[0];
      if (first?.index != null) {
        setActiveIndex(first.index);
        setPausedId(null);
      }
    },
    [],
  );

  const togglePause = useCallback(
    (id: string) => setPausedId((current) => (current === id ? null : id)),
    [],
  );

  if (reels.length === 0) {
    return (
      <View style={[styles.fill, styles.empty]}>
        <AppText variant="body" color={Colors.powderBlue}>
          {emptyMessage}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {height > 0 && (
        <FlatList
          data={reels}
          keyExtractor={(r) => r.id}
          renderItem={({ item, index }) => (
            <ReelItem
              reel={item}
              height={height}
              active={focused && index === activeIndex}
              shouldLoad={Math.abs(index - activeIndex) <= PRELOAD_RADIUS}
              paused={pausedId === item.id}
              muted={muted}
              onTogglePause={togglePause}
              bottomInset={bottomInset}
            />
          )}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          initialScrollIndex={Math.min(initialIndex, reels.length - 1)}
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}

      <Pressable
        accessibilityLabel={muted ? 'Unmute' : 'Mute'}
        hitSlop={10}
        onPress={() => setMuted((m) => !m)}
        style={[styles.mute, { top: topInset + Spacing.two }]}>
        {muted ? (
          <VolumeX size={20} color={Colors.iceWhite} />
        ) : (
          <Volume2 size={20} color={Colors.iceWhite} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: Colors.primaryDeep },
  empty: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  mute: {
    position: 'absolute',
    right: Spacing.three,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.scrim,
  },
});
