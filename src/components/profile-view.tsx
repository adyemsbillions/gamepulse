import { router } from 'expo-router';
import { BadgeCheck, Bookmark, Grid3x3, MapPin, Shield } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ReelGrid } from '@/components/reel-grid';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PulseLoader } from '@/components/ui/states';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useFeed, useMySupports } from '@/lib/queries';
import { useSessionUserId } from '@/lib/session';
import { adjustCount, engagement, useSupporting } from '@/lib/engagement-store';
import { formatCount } from '@/lib/format';
import type { FeedFilter } from '@/lib/api';
import type { User } from '@/lib/types';
import { useSafetyActions } from '@/lib/use-safety-actions';

type Tab = 'moments' | 'saved';

export function ProfileView({ user, header }: { user: User; header?: ReactNode }) {
  const isMe = user.id === useSessionUserId();
  const serverSupporting = useMySupports().data?.includes(user.id) ?? false;
  const supporting = useSupporting(user.id, serverSupporting);
  const [tab, setTab] = useState<Tab>('moments');
  const momentsFilter = { username: user.username };
  const moments = useFeed(momentsFilter);
  // Saves are private, so only your own profile has the tab; it loads the first time it's opened.
  const showSaved = isMe && tab === 'saved';
  const saved = useFeed({ saved: true }, { enabled: showSaved });
  const fans = adjustCount(user.fans, serverSupporting, supporting);
  const safety = useSafetyActions(user);

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
          {!!user.favoriteClub && (
            <Chip
              icon={<Shield size={14} color={Colors.primary} />}
              label={user.favoriteClub}
              onPress={() => router.push(`/club/${encodeURIComponent(user.favoriteClub)}`)}
            />
          )}
        </View>

        <View style={styles.stats}>
          <Stat value={moments.reels.length} more={moments.hasNextPage} label="Moments" />
          <View style={styles.divider} />
          <Stat value={fans} label="Fans" />
          <View style={styles.divider} />
          <Stat value={user.supporting} label="Supporting" />
        </View>

        {isMe ? (
          <Button label="Edit profile" variant="secondary" onPress={() => router.push('/edit-profile')} style={styles.cta} />
        ) : safety.blocked ? (
          <>
            <AppText variant="caption" color={Colors.textSecondary} style={styles.blockedNote}>
              You blocked @{user.username}. You won&apos;t see each other&apos;s Moments or comments.
            </AppText>
            <Button
              label={safety.busy ? 'Unblocking…' : 'Unblock'}
              variant="secondary"
              disabled={safety.busy}
              onPress={safety.unblock}
              style={styles.cta}
            />
          </>
        ) : (
          <Button
            label={supporting ? 'Supporting' : 'Support'}
            variant={supporting ? 'secondary' : 'primary'}
            onPress={() => engagement.support(user.id, supporting)}
            style={styles.cta}
          />
        )}

        {!!user.bio && (
          <AppText variant="body" style={styles.bio}>
            {user.bio}
          </AppText>
        )}
      </View>

      {isMe && (
        <View style={styles.tabs} accessibilityRole="tablist">
          <TabButton
            label="Moments"
            icon={Grid3x3}
            active={tab === 'moments'}
            onPress={() => setTab('moments')}
          />
          <TabButton label="Saved" icon={Bookmark} active={tab === 'saved'} onPress={() => setTab('saved')} />
        </View>
      )}

      {showSaved ? (
        <ReelsSection
          feed={saved}
          filter={{ saved: true }}
          empty="Moments you save show up here. Only you can see them."
        />
      ) : (
        <ReelsSection
          feed={moments}
          filter={momentsFilter}
          empty={safety.blocked ? 'Unblock to see their Moments.' : 'No Moments yet.'}
        />
      )}
    </ScrollView>
  );
}

function ReelsSection({
  feed,
  filter,
  empty,
}: {
  feed: ReturnType<typeof useFeed>;
  filter: FeedFilter;
  empty: string;
}) {
  if (feed.isPending) {
    return (
      <View style={styles.loading}>
        <PulseLoader />
      </View>
    );
  }
  if (feed.reels.length === 0) {
    return (
      <AppText color={Colors.textSecondary} style={styles.empty}>
        {feed.isError ? "Couldn't load Moments." : empty}
      </AppText>
    );
  }
  return (
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
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  icon: typeof Grid3x3;
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? Colors.primary : Colors.textSecondary;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}>
      <Icon size={18} color={color} />
      <AppText variant="bodyBold" color={color}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Chip({ icon, label, onPress }: { icon: ReactNode; label: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'link' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={styles.chip}>
      {icon}
      <AppText variant="label" color={Colors.primary}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Stat({ value, label, more }: { value: number; label: string; more?: boolean }) {
  return (
    <View style={styles.stat}>
      <AppText variant="heading">
        {formatCount(value)}
        {more ? '+' : ''}
      </AppText>
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
  blockedNote: { textAlign: 'center', marginTop: Spacing.three },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  empty: { textAlign: 'center', padding: Spacing.five },
  loading: { alignItems: 'center', padding: Spacing.five },
  more: { margin: Spacing.three },
});
