import { router } from 'expo-router';
import { Share2, Shield, Timer } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/states';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatCount } from '@/lib/format';
import { ordinal, rankFor, timeLeft, weekEndsAt } from '@/lib/pulse';
import { useClubWars, useMe, useMyWeek, useTopFans } from '@/lib/queries';
import type { ClubStanding, FanStanding } from '@/lib/types';

type Tab = 'clubs' | 'fans';

/** This week's tables: Club Wars and Top fans. Both reset Monday 00:00 Lagos time. */
export default function Leagues() {
  const [tab, setTab] = useState<Tab>('clubs');
  const resetsIn = useCountdown();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="This week" back />
      <View style={styles.resetRow}>
        <Timer size={14} color={Colors.textSecondary} />
        <AppText variant="caption" color={Colors.textSecondary}>
          Tables reset in {resetsIn}
        </AppText>
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        <TabButton label="Club Wars" active={tab === 'clubs'} onPress={() => setTab('clubs')} />
        <TabButton label="Top fans" active={tab === 'fans'} onPress={() => setTab('fans')} />
      </View>
      {tab === 'clubs' ? <ClubWars /> : <TopFans />}
    </SafeAreaView>
  );
}

function useCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return timeLeft(weekEndsAt(now), now);
}

// ---------------------------------------------------------------- Club Wars

function ClubWars() {
  const { data: me } = useMe();
  const clubs = useClubWars();
  const myKey = me?.favoriteClub.trim().toLowerCase();
  const mine = clubs.data?.find((c) => c.club.trim().toLowerCase() === myKey);

  if (clubs.isPending) return <LoadingView />;
  if (clubs.isError) return <ErrorView onRetry={() => clubs.refetch()} />;

  return (
    <FlatList
      data={clubs.data}
      keyExtractor={(c) => c.club}
      ListHeaderComponent={
        <View style={styles.intro}>
          <AppText variant="caption" color={Colors.textSecondary}>
            Every Pulse point a fan earns this week counts for their club.
          </AppText>
          {me && mine && <ClubBanner club={mine} />}
        </View>
      }
      renderItem={({ item }) => (
        <ClubRow club={item} mine={item === mine} onPress={() => router.push(`/club/${encodeURIComponent(item.club)}`)} />
      )}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListEmptyComponent={<EmptyView message="No points yet this week. Post a Moment to get your club on the board." />}
      contentContainerStyle={styles.list}
    />
  );
}

function ClubBanner({ club }: { club: ClubStanding }) {
  const share = () =>
    void Share.share({
      message:
        club.position === 1
          ? `${club.club} fans are TOP of Club Wars on GamePulse this week ⚽🔥 Who's stopping us?`
          : `${club.club} fans are ${ordinal(club.position)} in Club Wars on GamePulse this week ⚽ Come and help us climb!`,
    });
  return (
    <View style={styles.banner}>
      <View style={styles.flex}>
        <AppText variant="label" color={Colors.powderBlue}>
          Your club
        </AppText>
        <AppText variant="heading" color={Colors.iceWhite}>
          {club.club} · {ordinal(club.position)}
        </AppText>
        <AppText variant="caption" color={Colors.powderBlue}>
          {formatCount(club.points)} Pulse from {formatCount(club.fans)} {club.fans === 1 ? 'fan' : 'fans'}
        </AppText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Share your club's position" onPress={share} hitSlop={8} style={styles.shareBtn}>
        <Share2 size={18} color={Colors.primaryDeep} />
        <AppText variant="label" color={Colors.primaryDeep}>
          Share
        </AppText>
      </Pressable>
    </View>
  );
}

function ClubRow({ club, mine, onPress }: { club: ClubStanding; mine: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${ordinal(club.position)}, ${club.club}, ${club.points} Pulse`}
      onPress={onPress}
      style={[styles.row, mine && styles.mine]}>
      <Position n={club.position} />
      <View style={styles.clubBadge}>
        <Shield size={18} color={Colors.iceWhite} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyBold" numberOfLines={1}>
          {club.club}
        </AppText>
        <AppText variant="caption" color={Colors.textSecondary}>
          {formatCount(club.fans)} {club.fans === 1 ? 'fan' : 'fans'}
        </AppText>
      </View>
      <Points value={club.points} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Top fans

function TopFans() {
  const { data: me } = useMe();
  const [local, setLocal] = useState(false);
  const country = local && me?.country ? me.country : null;
  const fans = useTopFans(country);
  const week = useMyWeek();
  const myPosition = country ? week.data?.countryPosition : week.data?.position;

  return (
    <FlatList
      data={fans.data ?? []}
      keyExtractor={(f) => f.user.id}
      ListHeaderComponent={
        <View style={styles.intro}>
          {me?.country ? (
            <View style={styles.scope}>
              <ScopeChip label="Everywhere" active={!local} onPress={() => setLocal(false)} />
              <ScopeChip label={`${me.countryFlag} ${me.country}`} active={local} onPress={() => setLocal(true)} />
            </View>
          ) : null}
          {me && week.data && (
            <View style={styles.banner}>
              <View style={styles.flex}>
                <AppText variant="label" color={Colors.powderBlue}>
                  You this week
                </AppText>
                <AppText variant="heading" color={Colors.iceWhite}>
                  {myPosition ? ordinal(myPosition) : 'Not on the board yet'}
                </AppText>
                <AppText variant="caption" color={Colors.powderBlue}>
                  {formatCount(week.data.points)} Pulse · post a Moment to climb
                </AppText>
              </View>
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => <FanRow fan={item} mine={item.user.id === me?.id} />}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
      ListEmptyComponent={
        fans.isPending ? (
          <LoadingView />
        ) : fans.isError ? (
          <ErrorView onRetry={() => fans.refetch()} />
        ) : (
          <EmptyView message="Nobody has earned Pulse this week yet. Be the first." />
        )
      }
      contentContainerStyle={styles.list}
    />
  );
}

function FanRow({ fan, mine }: { fan: FanStanding; mine: boolean }) {
  const { rank } = rankFor(fan.user.pulsePoints ?? 0);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${ordinal(fan.position)}, @${fan.user.username}, ${fan.weekPoints} Pulse this week`}
      onPress={() => router.push(`/user/${fan.user.username}`)}
      style={[styles.row, mine && styles.mine]}>
      <Position n={fan.position} />
      <Avatar user={fan.user} size={40} />
      <View style={styles.flex}>
        <AppText variant="bodyBold" numberOfLines={1}>
          @{fan.user.username}
        </AppText>
        <AppText variant="caption" color={Colors.textSecondary} numberOfLines={1}>
          {rank.name} · {fan.user.countryFlag} {fan.user.favoriteClub}
        </AppText>
      </View>
      <Points value={fan.weekPoints} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- bits

function Position({ n }: { n: number }) {
  const medal = n <= 3;
  return (
    <View style={[styles.position, medal && styles.medal]}>
      <AppText style={styles.positionText} color={medal ? Colors.primaryDeep : Colors.textSecondary}>
        {n}
      </AppText>
    </View>
  );
}

function Points({ value }: { value: number }) {
  return (
    <View style={styles.points}>
      <AppText variant="bodyBold" color={Colors.primary}>
        {formatCount(value)}
      </AppText>
      <AppText variant="label" color={Colors.textSecondary}>
        Pulse
      </AppText>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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

function ScopeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.scopeChip, active && styles.scopeChipOn]}>
      <AppText variant="label" color={active ? Colors.iceWhite : Colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  resetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, paddingHorizontal: Spacing.three },
  tabs: {
    flexDirection: 'row',
    marginTop: Spacing.two,
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
  list: { paddingBottom: Spacing.six },
  intro: { gap: Spacing.three, padding: Spacing.three },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDeep,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: Colors.pulse,
  },
  scope: { flexDirection: 'row', gap: Spacing.two },
  scopeChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scopeChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  mine: { backgroundColor: Colors.surfaceMuted },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: Spacing.three },
  position: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  medal: { backgroundColor: Colors.pulse },
  positionText: { fontFamily: Fonts.bold, fontSize: 13 },
  clubBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.powderBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  points: { alignItems: 'flex-end' },
});
