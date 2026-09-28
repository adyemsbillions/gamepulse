import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/logo';
import { ReelFeed } from '@/components/reels/reel-feed';
import { AppText } from '@/components/ui/app-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { getFeed } from '@/lib/api';
import { useEngagement } from '@/lib/engagement-store';

type FeedTab = 'hot' | 'supporting';

export default function ReelsHome() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [tab, setTab] = useState<FeedTab>('hot');
  const supporting = useEngagement((s) => s.supporting);

  const reels = useMemo(() => {
    const all = getFeed();
    return tab === 'hot' ? all : all.filter((r) => supporting.has(r.userId));
  }, [tab, supporting]);

  return (
    <View style={styles.container}>
      {focused && <StatusBar style="light" />}
      <ReelFeed
        key={tab}
        reels={reels}
        topInset={insets.top}
        emptyMessage="Support GameMakers to fill your Supporting feed."
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
