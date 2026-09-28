import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AtSign, Bell, MessageCircle, Repeat2, UserPlus, type LucideIcon } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PulseBall } from '@/components/brand/pulse-ball';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Spacing } from '@/constants/theme';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/states';
import { useMarkNotificationsRead, useNotifications } from '@/lib/queries';
import { useSessionUserId } from '@/lib/session';
import { timeAgo } from '@/lib/format';
import type { AppNotification, NotificationType } from '@/lib/types';

const ICONS: Record<Exclude<NotificationType, 'cheer'>, LucideIcon> = {
  comment: MessageCircle,
  new_fan: UserPlus,
  mention: AtSign,
  replay: Repeat2,
  system: Bell,
};

function TypeBadge({ type }: { type: NotificationType }) {
  if (type === 'cheer') return <PulseBall size={15} body={Colors.primary} panel={Colors.pulse} />;
  const Icon = ICONS[type];
  return <Icon size={12} color={Colors.primary} />;
}

export default function NotificationsScreen() {
  const uid = useSessionUserId();
  const { data, isPending, isError, refetch, isRefetching } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = data?.some((n) => !n.read) ?? false;

  // Unread rows stay highlighted while you're looking; they're marked read when you leave.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (unread) markRead.mutate();
      };
      // markRead is stable enough for this; re-run only when there's something new to mark.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unread]),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Notifications" />
      {uid === null ? (
        <View style={styles.signedOut}>
          <EmptyView
            style={styles.signedOutText}
            message="Sign in to see who cheered your Moments, commented and became your Fan."
          />
          <Button label="Sign in with Google" onPress={() => router.push('/sign-in')} style={styles.cta} />
        </View>
      ) : isPending ? (
        <LoadingView />
      ) : isError ? (
        <ErrorView onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <NotificationRow n={item} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          onRefresh={() => refetch()}
          refreshing={isRefetching}
          ListEmptyComponent={<EmptyView message="Nothing yet. Post a Moment and the pulses will show up here." />}
          contentContainerStyle={data.length === 0 ? styles.fill : undefined}
        />
      )}
    </SafeAreaView>
  );
}

function NotificationRow({ n }: { n: AppNotification }) {
  const actor = n.actor;

  const open = () => {
    if (n.reelId) router.push(`/comments/${n.reelId}`);
    else if (actor) router.push(`/user/${actor.username}`);
  };

  return (
    <Pressable onPress={open} style={[styles.row, !n.read && styles.unread]}>
      <View>
        {actor ? (
          <Avatar user={actor} size={46} />
        ) : (
          <View style={styles.systemIcon}>
            <Bell size={22} color={Colors.iceWhite} />
          </View>
        )}
        <View style={styles.badge}>
          <TypeBadge type={n.type} />
        </View>
      </View>
      <AppText variant="body" style={styles.text}>
        {actor && <AppText variant="bodyBold">@{actor.username} </AppText>}
        {n.text}
        <AppText variant="caption" color={Colors.textSecondary}>
          {'  '}
          {timeAgo(n.createdAt)}
        </AppText>
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  unread: { backgroundColor: Colors.surfaceMuted },
  fill: { flexGrow: 1 },
  signedOut: { flex: 1, justifyContent: 'center', paddingBottom: Spacing.six },
  signedOutText: { flex: 0 },
  cta: { marginHorizontal: Spacing.four },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  text: { flex: 1 },
  systemIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
