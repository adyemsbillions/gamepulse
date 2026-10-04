import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReelGrid } from '@/components/reel-grid';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { PulseLoader } from '@/components/ui/states';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { formatCount } from '@/lib/format';
import { useClubFans, useFeed } from '@/lib/queries';

/** A club: the GameMakers who back it and the Moments they post. */
export default function ClubScreen() {
  const { name: raw } = useLocalSearchParams<{ name: string }>();
  const name = (raw ?? '').trim();
  const fans = useClubFans(name);
  const filter = { club: name };
  const feed = useFeed(filter);
  const fanList = fans.data ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={name} back />
      <ScrollView>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <AppText style={styles.initial} color={Colors.iceWhite}>
              {name[0]?.toUpperCase() ?? '?'}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="title">{name}</AppText>
            <AppText variant="caption" color={Colors.textSecondary}>
              {fans.isPending
                ? 'Finding fans…'
                : `${formatCount(fanList.length)}${fanList.length >= 30 ? '+' : ''} ${fanList.length === 1 ? 'fan' : 'fans'} on GamePulse`}
            </AppText>
          </View>
        </View>

        {fanList.length > 0 && (
          <>
            <AppText variant="heading" style={styles.section}>
              Fans
            </AppText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fans}>
              {fanList.map((u) => (
                <Pressable
                  key={u.id}
                  accessibilityLabel={`Open @${u.username}`}
                  onPress={() => router.push(`/user/${u.username}`)}
                  style={styles.fan}>
                  <Avatar user={u} size={56} />
                  <AppText variant="label" numberOfLines={1} style={styles.fanName}>
                    @{u.username}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <AppText variant="heading" style={styles.section}>
          Moments
        </AppText>
        {feed.isPending ? (
          <View style={styles.loading}>
            <PulseLoader />
          </View>
        ) : feed.reels.length > 0 ? (
          <>
            <ReelGrid reels={feed.reels} filter={filter} />
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
            {feed.isError ? "Couldn't load Moments." : `No Moments from ${name} fans yet.`}
          </AppText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.powderBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: { fontFamily: Fonts.display, fontSize: 28 },
  section: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  fans: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  fan: { alignItems: 'center', width: 68, gap: Spacing.one },
  fanName: { textAlign: 'center' },
  empty: { textAlign: 'center', padding: Spacing.five },
  loading: { alignItems: 'center', padding: Spacing.five },
  more: { margin: Spacing.three },
});
