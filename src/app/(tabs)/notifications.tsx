import { router } from 'expo-router';
import { AtSign, Bell, MessageCircle, Repeat2, UserPlus, type LucideIcon } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PulseBall } from '@/components/brand/pulse-ball';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Spacing } from '@/constants/theme';
import { getNotifications, getUser } from '@/lib/api';
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
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Notifications" />
      <FlatList
        data={getNotifications()}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => <NotificationRow n={item} />}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </SafeAreaView>
  );
}

function NotificationRow({ n }: { n: AppNotification }) {
  const actor = n.actorId ? getUser(n.actorId) : undefined;

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
