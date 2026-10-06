import { router } from 'expo-router';
import { ChevronRight, Trophy } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { joinChallenge } from '@/lib/challenges';
import { formatCount } from '@/lib/format';
import { timeLeft } from '@/lib/pulse';
import { useChallenges } from '@/lib/queries';

/** This week's challenge, with a Join button. Shown on Discover and Create. */
export function ChallengeCard({ onCreateTab = false }: { onCreateTab?: boolean }) {
  const { data } = useChallenges();
  const challenge = data?.current;
  if (!challenge) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`This week's challenge: ${challenge.title}, #${challenge.tag}. Open it.`}
      onPress={() => router.push(`/challenge/${challenge.id}`)}
      style={({ pressed }) => [styles.card, onCreateTab && styles.onCreate, pressed && styles.pressed]}>
      <AppText style={styles.emoji}>{challenge.emoji}</AppText>
      <View style={styles.flex}>
        <View style={styles.kicker}>
          <Trophy size={12} color={Colors.primaryDeep} />
          <AppText variant="label" color={Colors.primaryDeep}>
            THIS WEEK&apos;S CHALLENGE · ends in {timeLeft(Date.parse(challenge.endsAt))}
          </AppText>
        </View>
        <AppText variant="heading" color={Colors.primaryDeep}>
          #{challenge.tag}
        </AppText>
        <AppText variant="caption" color={Colors.primaryDeep} numberOfLines={2}>
          {challenge.description} {formatCount(challenge.entries)} {challenge.entries === 1 ? 'entry' : 'entries'} so
          far.
        </AppText>
      </View>
      <View style={styles.side}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Join #${challenge.tag}`}
          hitSlop={8}
          onPress={() => joinChallenge(challenge)}
          style={styles.join}>
          <AppText variant="label" color={Colors.pulse}>
            Join
          </AppText>
        </Pressable>
        <ChevronRight size={18} color={Colors.primaryDeep} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.pulse,
  },
  onCreate: { marginHorizontal: 0, marginTop: Spacing.three },
  pressed: { opacity: 0.9 },
  emoji: { fontSize: 34, lineHeight: 42 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  side: { alignItems: 'center', gap: Spacing.two },
  join: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryDeep,
  },
});
