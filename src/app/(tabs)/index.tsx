import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/logo';
import { ReelFeed } from '@/components/reels/reel-feed';
import { AppText } from '@/components/ui/app-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useSupportingOverrides } from '@/lib/engagement-store';
import { useFeed, useMySupports } from '@/lib/queries';

type FeedTab = 'hot' | 'supporting';

export default function ReelsHome() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [tab, setTab] = useState<FeedTab>('hot');
  const serverSupports = useMySupports().data;
  const overrides = useSupportingOverrides();
  const supporting = useMemo(() => {
    const set = new Set(serverSupports ?? []);
    overrides.forEach((on, id) => (on ? set.add(id) : set.delete(id)));
    return set;
  }, [serverSupports, overrides]);

  const feed = useFeed();
  const reels = useMemo(
    () => (tab === 'hot' ? feed.reels : feed.reels.filter((r) => supporting.has(r.userId))),
    [tab, supporting, feed.reels],
  );

  return (
    <View style={styles.container}>
      {focused && <StatusBar style="light" />}
      <ReelFeed
        key={tab}
        reels={reels}
        topInset={insets.top}
        emptyMessage={
          tab === 'hot' ? 'No Moments yet. Be the first to post one.' : 'Support GameMakers to fill your Supporting feed.'
        }
        loading={feed.isPending}
        error={feed.isError}
        onRetry={() => feed.refetch()}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        loadingMore={feed.isFetchingNextPage}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]} pointerEvents="box-none">
        <View style={styles.brand} accessibilityRole="header" accessibilityLabel="GamePulse">
          <LogoMark width={34} glow={false} />
          <AppText style={styles.wordmark} color={Colors.iceWhite}>
            GAMEPULSE
          </AppText>
        </View>
        <View style={styles.switcher}>
          <FeedTabButton label="Hot Now" active={tab === 'hot'} onPress={() => setTab('hot')} />
          <FeedTabButton
            label="Supporting"
            active={tab === 'supporting'}
            onPress={() => setTab('supporting')}
          />
        </View>
      </View>
    </View>
  );
}

function FeedTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} hitSlop={8}>
      <AppText variant="bodyBold" color={active ? Colors.iceWhite : Colors.powderBlue} style={styles.shadow}>
        {label}
      </AppText>
      <View style={[styles.underline, active && styles.underlineActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.primaryDeep },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.one,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.92 },
  wordmark: { fontFamily: Fonts.display, fontSize: 13, letterSpacing: 3 },
  switcher: { flexDirection: 'row', gap: Spacing.four },
  underline: { height: 2, marginTop: 2, borderRadius: 1, backgroundColor: 'transparent' },
  underlineActive: { backgroundColor: Colors.iceWhite },
  shadow: {
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
