import { router, useLocalSearchParams } from 'expo-router';
import { Crown, Timer, Trophy } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReelGrid } from '@/components/reel-grid';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ErrorView, LoadingView, PulseLoader } from '@/components/ui/states';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { challengeState, joinChallenge } from '@/lib/challenges';
import { formatCount } from '@/lib/format';
import { timeLeft } from '@/lib/pulse';
import { useChallenge, useFeed } from '@/lib/queries';

/** One weekly challenge: the brief, the prize, the leaderboard of entries, and the winner. */
export default function ChallengeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: challenge, isPending, isError, refetch } = useChallenge(id);
  const filter = { challenge: id };
  const entries = useFeed(filter, { enabled: !!challenge });

  if (isPending) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Challenge" back />
        <LoadingView />
      </SafeAreaView>
    );
  }
  if (isError || !challenge) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Challenge" back />
        <ErrorView message={isError ? undefined : 'This challenge doesn’t exist.'} onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  const state = challengeState(challenge);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={`#${challenge.tag}`} back />
      <ScrollView>
        <View style={styles.hero}>
          <AppText style={styles.emoji}>{challenge.emoji}</AppText>
          <AppText variant="title" style={styles.center}>
            {challenge.title}
          </AppText>
          <AppText color={Colors.textSecondary} style={styles.center}>
            {challenge.description}
          </AppText>

          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Timer size={14} color={Colors.primary} />
              <AppText variant="label" color={Colors.primary}>
                {state === 'live'
                  ? `Ends in ${timeLeft(Date.parse(challenge.endsAt))}`
                  : state === 'upcoming'
                    ? `Starts in ${timeLeft(Date.parse(challenge.startsAt))}`
                    : 'Finished'}
              </AppText>
            </View>
            <View style={styles.metaItem}>
              <AppText variant="label" color={Colors.primary}>
                {formatCount(challenge.entries)} {challenge.entries === 1 ? 'entry' : 'entries'}
              </AppText>
            </View>
          </View>

          <View style={styles.prize}>
            <Trophy size={18} color={Colors.primaryDeep} />
            <AppText variant="caption" color={Colors.primaryDeep} style={styles.flex}>
              +10 Pulse for entering. The Moment with the most Cheers when it ends wins +100 Pulse and a
              trophy on their profile.
            </AppText>
          </View>

          {state === 'live' && (
            <Button label={`Join #${challenge.tag}`} onPress={() => joinChallenge(challenge)} style={styles.join} />
          )}
          {state === 'counting' && (
            <AppText variant="caption" color={Colors.textSecondary} style={styles.center}>
              Counting the Cheers. The winner is announced within the hour.
            </AppText>
          )}
          {challenge.winner && (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push(`/user/${challenge.winner!.username}`)}
              style={styles.winner}>
              <Crown size={20} color={Colors.pulse} />
              <Avatar user={challenge.winner} size={40} />
              <View style={styles.flex}>
                <AppText variant="label" color={Colors.powderBlue}>
                  WINNER
                </AppText>
                <AppText variant="bodyBold" color={Colors.iceWhite}>
                  @{challenge.winner.username}
                </AppText>
              </View>
            </Pressable>
          )}
        </View>

        <AppText variant="heading" style={styles.section}>
          {state === 'live' ? 'Leading entries' : 'Entries'}
        </AppText>
        {entries.isPending ? (
          <View style={styles.loading}>
            <PulseLoader />
          </View>
        ) : entries.reels.length > 0 ? (
          <>
            <ReelGrid reels={entries.reels} filter={filter} />
            {entries.hasNextPage && (
              <Button
                label={entries.isFetchingNextPage ? 'Loading…' : 'Show more entries'}
                variant="secondary"
                disabled={entries.isFetchingNextPage}
                onPress={() => entries.fetchNextPage()}
                style={styles.more}
              />
            )}
          </>
        ) : (
          <AppText color={Colors.textSecondary} style={styles.empty}>
            {entries.isError ? "Couldn't load entries." : 'No entries yet. Be the first and set the bar.'}
          </AppText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  hero: { alignItems: 'center', gap: Spacing.two, padding: Spacing.four },
  emoji: { fontSize: 56, lineHeight: 68 },
  meta: { flexDirection: 'row', gap: Spacing.three },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
  },
  prize: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'stretch',
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Colors.pulse,
  },
  join: { alignSelf: 'stretch', marginTop: Spacing.two },
  winner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    alignSelf: 'stretch',
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDeep,
  },
  section: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  empty: { textAlign: 'center', padding: Spacing.five },
  loading: { alignItems: 'center', padding: Spacing.five },
  more: { margin: Spacing.three },
});
