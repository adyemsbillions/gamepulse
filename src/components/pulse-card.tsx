import { router } from 'expo-router';
import { ChevronRight, Flame, Trophy, Zap } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatCount } from '@/lib/format';
import { rankFor } from '@/lib/pulse';
import type { User } from '@/lib/types';

/** Rank, points and streak. Full card on your own profile; a compact row on other people's. */
export function PulseCard({ user, isMe }: { user: User; isMe: boolean }) {
  const points = user.pulsePoints ?? 0;
  const streak = user.streakDays ?? 0;
  const wins = user.challengeWins ?? 0;
  const { rank, next, progress, toNext } = rankFor(points);

  if (!isMe) {
    return (
      <View style={styles.chips} accessibilityLabel={`${rank.name}, ${points} Pulse${streak > 1 ? `, ${streak}-day streak` : ''}`}>
        <View style={styles.chip}>
          <Zap size={14} color={Colors.primary} fill={Colors.pulse} />
          <AppText variant="label" color={Colors.primary}>
            {rank.name} · {formatCount(points)}
          </AppText>
        </View>
        {streak > 1 && (
          <View style={styles.chip}>
            <Flame size={14} color={Colors.hot} fill={Colors.hot} />
            <AppText variant="label" color={Colors.primary}>
              {streak}
            </AppText>
          </View>
        )}
        {wins > 0 && <WinsChip wins={wins} />}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rank.name}, ${points} Pulse. ${next ? `${toNext} to ${next.name}.` : ''} ${streak}-day streak. Open this week's tables.`}
      onPress={() => router.push('/leagues')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={styles.badge}>
          <Zap size={20} color={Colors.primaryDeep} fill={Colors.primaryDeep} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyBold" color={Colors.iceWhite}>
            {rank.name}
          </AppText>
          <AppText variant="caption" color={Colors.powderBlue}>
            {formatCount(points)} Pulse
          </AppText>
        </View>
        {wins > 0 && (
          <View style={styles.streak} accessibilityLabel={`${wins} challenge ${wins === 1 ? 'win' : 'wins'}`}>
            <Trophy size={18} color={Colors.pulse} />
            <AppText variant="bodyBold" color={Colors.iceWhite}>
              {wins}
            </AppText>
          </View>
        )}
        <View style={styles.streak}>
          <Flame size={18} color={streak > 0 ? Colors.hot : Colors.powderBlue} fill={streak > 0 ? Colors.hot : 'transparent'} />
          <AppText variant="bodyBold" color={Colors.iceWhite}>
            {streak}
          </AppText>
        </View>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(progress, 0.03) * 100}%` }]} />
      </View>
      <View style={styles.row}>
        <AppText variant="label" color={Colors.powderBlue} style={styles.flex}>
          {next ? `${formatCount(toNext)} to ${next.name}` : 'Top rank. Legend.'}
        </AppText>
        <AppText variant="label" color={Colors.pulse}>
          This week&apos;s tables
        </AppText>
        <ChevronRight size={14} color={Colors.pulse} />
      </View>
    </Pressable>
  );
}

function WinsChip({ wins }: { wins: number }) {
  return (
    <View style={styles.chip}>
      <Trophy size={14} color={Colors.primary} />
      <AppText variant="label" color={Colors.primary}>
        {wins} {wins === 1 ? 'win' : 'wins'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
  },
  card: {
    alignSelf: 'stretch',
    gap: Spacing.two,
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDeep,
  },
  pressed: { opacity: 0.9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.pulse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(169, 192, 224, 0.25)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: Colors.pulse },
});
