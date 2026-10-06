import { useLocalSearchParams } from 'expo-router';
import { Hash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReelGrid } from '@/components/reel-grid';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { PulseLoader } from '@/components/ui/states';
import { normalizeHashtag } from '@/lib/api';
import { useFeed, useHashtag } from '@/lib/queries';
import { formatCount } from '@/lib/format';

export default function HashtagScreen() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const name = normalizeHashtag(tag ?? '');
  const { data: hashtag } = useHashtag(name);
  const [sort, setSort] = useState<'hot' | 'latest'>('hot');
  const filter = { hashtag: name, sort };
  const feed = useFeed(filter);
  const reels = feed.reels;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={`#${name}`} back />
      <ScrollView>
        <View style={styles.hero}>
          <View style={styles.icon}>
            <Hash size={34} color={Colors.iceWhite} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title">#{name}</AppText>
            <AppText variant="caption" color={Colors.textSecondary}>
              {formatCount(hashtag?.usageCount ?? 0)} Moments
            </AppText>
          </View>
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          <SortTab label="Top" active={sort === 'hot'} onPress={() => setSort('hot')} />
          <SortTab label="Latest" active={sort === 'latest'} onPress={() => setSort('latest')} />
        </View>
        {feed.isPending ? (
          <View style={styles.loading}>
            <PulseLoader />
          </View>
        ) : reels.length > 0 ? (
          <>
            <ReelGrid reels={reels} filter={filter} />
            {feed.hasNextPage && (
              <Button
                label={feed.isFetchingNextPage ? 'Loading…' : 'Show more Moments'}
                variant="secondary"
                disabled={feed.isFetchingNextPage}
                onPress={() => feed.fetchNextPage()}
                style={styles.more}
              />
            )}
          </>
        ) : (
          <AppText color={Colors.textSecondary} style={styles.empty}>
            No Moments with this hashtag yet.
          </AppText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SortTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}>
      <AppText variant="bodyBold" color={active ? Colors.primary : Colors.textSecondary}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  more: { margin: Spacing.three },
  container: { flex: 1, backgroundColor: Colors.background },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  icon: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { textAlign: 'center', padding: Spacing.five },
  loading: { alignItems: 'center', padding: Spacing.five },
});
