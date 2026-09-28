import { BadgeCheck, MapPin, Shield } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ReelGrid } from '@/components/reel-grid';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { CURRENT_USER_ID, getFeed } from '@/lib/api';
import { engagement, useEngagement } from '@/lib/engagement-store';
import { formatCount } from '@/lib/format';
import type { User } from '@/lib/types';

export function ProfileView({ user, header }: { user: User; header?: ReactNode }) {
  const isMe = user.id === CURRENT_USER_ID;
  const supporting = useEngagement((s) => s.supporting.has(user.id));
  const reels = getFeed({ username: user.username });
  const fans = user.fans + (supporting ? 1 : 0);

  return (
    <ScrollView style={styles.container}>
      {header}
      <View style={styles.top}>
        <Avatar user={user} size={92} />
        <View style={styles.nameRow}>
          <AppText variant="title">{user.displayName}</AppText>
          {user.verified && <BadgeCheck size={20} color={Colors.primary} />}
        </View>
        <AppText variant="caption" color={Colors.textSecondary}>
          @{user.username}
        </AppText>

        <View style={styles.chips}>
          <Chip icon={<MapPin size={14} color={Colors.primary} />} label={`${user.countryFlag} ${user.country}`} />
          <Chip icon={<Shield size={14} color={Colors.primary} />} label={user.favoriteClub} />
        </View>

        <View style={styles.stats}>
          <Stat value={reels.length} label="Moments" />
          <View style={styles.divider} />
          <Stat value={fans} label="Fans" />
          <View style={styles.divider} />
          <Stat value={user.supporting} label="Supporting" />
        </View>

        {isMe ? (
          <Button label="Edit profile" variant="secondary" style={styles.cta} />
        ) : (
          <Button
            label={supporting ? 'Supporting' : 'Support'}
            variant={supporting ? 'secondary' : 'primary'}
            onPress={() => engagement.toggleSupport(user.id)}
            style={styles.cta}
          />
        )}

        {!!user.bio && (
          <AppText variant="body" style={styles.bio}>
            {user.bio}
          </AppText>
        )}
      </View>

      {reels.length > 0 ? (
        <ReelGrid reels={reels} filter={{ username: user.username }} />
      ) : (
        <AppText color={Colors.textSecondary} style={styles.empty}>
          No Moments yet.
        </AppText>
      )}
    </ScrollView>
  );
}

function Chip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={styles.chip}>
      {icon}
      <AppText variant="label" color={Colors.primary}>
        {label}
      </AppText>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="heading">{formatCount(value)}</AppText>
      <AppText variant="label" color={Colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  top: { alignItems: 'center', paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.one },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginTop: Spacing.two },
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
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.three },
  stat: { alignItems: 'center', minWidth: 90 },
  divider: { width: 1, height: 28, backgroundColor: Colors.border },
  cta: { marginTop: Spacing.three, minWidth: 180 },
  bio: { textAlign: 'center', marginTop: Spacing.three },
  empty: { textAlign: 'center', padding: Spacing.five },
});
