import { router } from 'expo-router';
import { Bookmark, Ellipsis, MessageCircle, Repeat2, Share2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';

import { CheerButton } from './cheer-button';

import { actionSheet } from '@/components/ui/action-sheet';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Colors, Spacing } from '@/constants/theme';
import { data } from '@/lib/api';
import { requireSignIn } from '@/lib/auth';
import { respondTo } from '@/lib/challenges';
import { downloadMoment } from '@/lib/downloads';
import { mediaToolsAvailable } from '@/lib/media-tools';
import { adjustCount, engagement, useCheered, useReplayed, useSaved } from '@/lib/engagement-store';
import { formatCount } from '@/lib/format';
import { useDeleteReel, useNotInterested } from '@/lib/queries';
import { useSessionUserId } from '@/lib/session';
import type { Reel, User } from '@/lib/types';
import { useSafetyActions } from '@/lib/use-safety-actions';

export function ReelActions({ reel, creator }: { reel: Reel; creator: User }) {
  const cheered = useCheered(reel);
  const saved = useSaved(reel);
  const replayed = useReplayed(reel);
  const isMine = useSessionUserId() === reel.userId;
  const deleteReel = useDeleteReel();
  const safety = useSafetyActions(creator);
  const notInterested = useNotInterested();

  const share = async () => {
    const result = await Share.share({
      message: `${reel.caption}\n\nWatch on GamePulse: https://gamepulse.app/reel/${reel.id}`,
    });
    if (result.action === Share.sharedAction) data.recordShare(reel.id).catch(() => {});
  };

  const confirmDelete = () =>
    Alert.alert('Delete this Moment?', 'It will be gone for good, with its cheers and comments.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteReel.mutate(reel.id, {
            onError: () => Alert.alert("Couldn't delete", 'Check your connection and try again.'),
          }),
      },
    ]);

  // Download with the GamePulse watermark: Android builds that include the media module.
  const save = mediaToolsAvailable && reel.playbackUrl ? [{ label: 'Save video', onPress: () => void downloadMoment(reel) }] : [];

  const more = () =>
    isMine
      ? actionSheet.show({
          title: 'Your Moment',
          options: [...save, { label: 'Delete Moment', destructive: true, onPress: confirmDelete }],
        })
      : actionSheet.show({
          title: `@${creator.username}'s Moment`,
          options: [
            ...save,
            { label: 'Respond with your Moment', onPress: () => respondTo(reel) },
            {
              label: 'Report',
              destructive: true,
              onPress: () => requireSignIn() && router.push(`/report?reelId=${reel.id}`),
            },
            ...safety.options,
            {
              label: 'Not interested',
              onPress: () =>
                requireSignIn() &&
                notInterested.mutate(reel.id, {
                  onError: () => Alert.alert("That didn't go through", 'Check your connection and try again.'),
                }),
            },
          ],
        });

  return (
    <View style={styles.column}>
      <Pressable
        accessibilityLabel={`Open ${creator.displayName}'s profile`}
        onPress={() => router.push(`/user/${creator.username}`)}
        style={styles.avatar}>
        <Avatar user={creator} size={46} ring={Colors.iceWhite} />
      </Pressable>

      <CheerButton reel={reel} active={cheered} count={adjustCount(reel.cheers, reel.viewer.cheered, cheered)} />
      <Action
        label="Comments"
        count={reel.comments}
        onPress={() => router.push(`/comments/${reel.id}`)}
        icon={<MessageCircle size={30} color={Colors.iceWhite} />}
      />
      <Action
        label="Replay"
        count={adjustCount(reel.replays, reel.viewer.replayed, replayed)}
        onPress={() => engagement.replay(reel, replayed)}
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
        onPress={() => engagement.save(reel, saved)}
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count !== undefined ? `${label}, ${formatCount(count)}` : label}
      hitSlop={6}
      onPress={onPress}
      style={styles.action}>
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
