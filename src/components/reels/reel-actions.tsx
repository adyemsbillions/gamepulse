import { router } from 'expo-router';
import { Bookmark, Ellipsis, MessageCircle, Repeat2, Share2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import { CheerButton } from './cheer-button';

import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Colors, Spacing } from '@/constants/theme';
import { engagement, useEngagement } from '@/lib/engagement-store';
import { formatCount } from '@/lib/format';
import type { Reel, User } from '@/lib/types';

export function ReelActions({ reel, creator }: { reel: Reel; creator: User }) {
  const cheered = useEngagement((s) => s.cheered.has(reel.id));
  const saved = useEngagement((s) => s.saved.has(reel.id));
  const replayed = useEngagement((s) => s.replayed.has(reel.id));
  const extraComments = useEngagement((s) => s.newComments.filter((c) => c.reelId === reel.id).length);

  const share = () =>
    Share.share({
      message: `${reel.caption}\n\nWatch on GamePulse: https://gamepulse.app/reel/${reel.id}`,
    });

  const more = () =>
    Alert.alert('Moment options', undefined, [
      { text: 'Report', style: 'destructive', onPress: () => router.push(`/report?reelId=${reel.id}`) },
      { text: 'Not interested' },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <View style={styles.column}>
      <Pressable
        accessibilityLabel={`Open ${creator.displayName}'s profile`}
        onPress={() => router.push(`/user/${creator.username}`)}
        style={styles.avatar}>
        <Avatar user={creator} size={46} ring={Colors.iceWhite} />
      </Pressable>

      <CheerButton reelId={reel.id} active={cheered} count={reel.cheers + (cheered ? 1 : 0)} />
      <Action
        label="Comments"
        count={reel.comments + extraComments}
        onPress={() => router.push(`/comments/${reel.id}`)}
        icon={<MessageCircle size={30} color={Colors.iceWhite} />}
      />
      <Action
        label="Replay"
        count={reel.replays + (replayed ? 1 : 0)}
        onPress={() => engagement.toggleReplay(reel.id)}
        icon={<Repeat2 size={30} color={replayed ? Colors.powderBlue : Colors.iceWhite} />}
      />
      <Action
        label="Share"
        count={reel.shares}
        onPress={share}
        icon={<Share2 size={28} color={Colors.iceWhite} />}
      />
      <Action
        label="Save"
        onPress={() => engagement.toggleSave(reel.id)}
        icon={
          <Bookmark
            size={28}
            color={saved ? Colors.powderBlue : Colors.iceWhite}
            fill={saved ? Colors.powderBlue : 'transparent'}
          />
        }
      />
      <Action label="More" onPress={more} icon={<Ellipsis size={28} color={Colors.iceWhite} />} />
    </View>
  );
}

function Action({
  label,
  count,
  icon,
  onPress,
}: {
  label: string;
  count?: number;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={label} hitSlop={6} onPress={onPress} style={styles.action}>
      {icon}
      {count !== undefined && (
        <AppText variant="label" color={Colors.iceWhite} style={styles.shadow}>
          {formatCount(count)}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: Spacing.three },
  avatar: { marginBottom: Spacing.one },
  action: { alignItems: 'center', gap: 2 },
  shadow: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
