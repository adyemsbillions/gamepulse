/**
 * Block and mute (GP-036), shared by the reel menu and the profile menu.
 */
import { Alert } from 'react-native';

import type { ActionSheetOption } from '@/components/ui/action-sheet';

import { requireSignIn } from './auth';
import { UserFacingError } from './data/source';
import { engagement } from './engagement-store';
import { useMyRelations, useSetBlock, useSetMute } from './queries';
import { useSessionUserId } from './session';
import type { User } from './types';

const failed = (e: unknown) =>
  Alert.alert("That didn't go through", e instanceof UserFacingError ? e.message : 'Check your connection and try again.');

export function useSafetyActions(user: Pick<User, 'id' | 'username'>) {
  const isMe = useSessionUserId() === user.id;
  const relations = useMyRelations().data;
  const blocked = relations?.blocked.includes(user.id) ?? false;
  const muted = relations?.muted.includes(user.id) ?? false;
  const setBlock = useSetBlock();
  const setMute = useSetMute();
  const name = `@${user.username}`;

  const block = () => {
    if (!requireSignIn()) return;
    Alert.alert(
      `Block ${name}?`,
      "You won't see each other's Moments or comments, and they can't cheer, comment on or support yours. They won't be told.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () =>
            setBlock.mutate(
              { userId: user.id, on: true },
              { onSuccess: () => engagement.forgetSupport(user.id), onError: failed },
            ),
        },
      ],
    );
  };

  const unblock = () => setBlock.mutate({ userId: user.id, on: false }, { onError: failed });

  const toggleMute = () => {
    if (!requireSignIn()) return;
    setMute.mutate(
      { userId: user.id, on: !muted },
      {
        onSuccess: () =>
          Alert.alert(
            muted ? `${name} unmuted` : `${name} muted`,
            muted
              ? 'Their Moments can show up in Hot Now again.'
              : "Their Moments won't show up in your Hot Now feed. They won't be told.",
          ),
        onError: failed,
      },
    );
  };

  const options: ActionSheetOption[] = isMe
    ? []
    : [
        { label: muted ? `Unmute ${name}` : `Mute ${name}`, onPress: toggleMute },
        blocked
          ? { label: `Unblock ${name}`, onPress: unblock }
          : { label: `Block ${name}`, destructive: true, onPress: block },
      ];

  return { isMe, blocked, muted, options, unblock, busy: setBlock.isPending || setMute.isPending };
}
