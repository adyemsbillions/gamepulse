import { router } from 'expo-router';
import { ChevronRight, Swords } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatCount } from '@/lib/format';
import { ordinal } from '@/lib/pulse';
import { useClubWars, useMe } from '@/lib/queries';

/** Discover's teaser for this week's Club Wars: the top three and where your club stands. */
export function ClubWarsCard() {
  const clubs = useClubWars().data ?? [];
  const { data: me } = useMe();
  if (clubs.length === 0) return null;

  const myKey = me?.favoriteClub.trim().toLowerCase();
  const mine = clubs.find((c) => c.club.trim().toLowerCase() === myKey);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Club Wars this week. Open the tables."
      onPress={() => router.push('/leagues')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.header}>
        <Swords size={18} color={Colors.pulse} />
        <AppText variant="bodyBold" color={Colors.iceWhite} style={styles.flex}>
          Club Wars this week
        </AppText>
        <ChevronRight size={18} color={Colors.powderBlue} />
      </View>
      {clubs.slice(0, 3).map((c) => (
        <View key={c.club} style={styles.row}>
          <View style={styles.position}>
            <AppText style={styles.positionText} color={Colors.primaryDeep}>
              {c.position}
            </AppText>
          </View>
          <AppText variant="body" color={Colors.iceWhite} numberOfLines={1} style={styles.flex}>
            {c.club}
          </AppText>
          <AppText variant="bodyBold" color={Colors.pulse}>
            {formatCount(c.points)}
          </AppText>
        </View>
      ))}
      {mine && mine.position > 3 && (
        <AppText variant="caption" color={Colors.powderBlue}>
          {mine.club} is {ordinal(mine.position)} with {formatCount(mine.points)} Pulse. Post a Moment to push them up.
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDeep,
  },
  pressed: { opacity: 0.9 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  position: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.pulse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: { fontFamily: Fonts.bold, fontSize: 12 },
});
