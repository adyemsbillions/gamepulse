import { useLocalSearchParams } from 'expo-router';
import { Ellipsis } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile-view';
import { actionSheet } from '@/components/ui/action-sheet';
import { AppText } from '@/components/ui/app-text';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Spacing } from '@/constants/theme';
import { LoadingView } from '@/components/ui/states';
import { useUserByUsername } from '@/lib/queries';
import type { User } from '@/lib/types';
import { useSafetyActions } from '@/lib/use-safety-actions';

export default function UserScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { data: user, isPending, isError, refetch } = useUserByUsername(username);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {isPending ? (
        <>
          <ScreenHeader title="Profile" back />
          <LoadingView />
        </>
      ) : user ? (
        <ProfileView
          user={user}
          header={<ScreenHeader title={`@${user.username}`} back right={<ProfileMenu user={user} />} />}
        />
      ) : (
        <>
          <ScreenHeader title="Profile" back />
          <AppText color={Colors.textSecondary} style={styles.missing} onPress={isError ? () => refetch() : undefined}>
            {isError ? "Couldn't load this profile. Tap to try again." : "This GameMaker doesn't exist."}
          </AppText>
        </>
      )}
    </SafeAreaView>
  );
}

/** Mute / block. Nothing to show on your own profile. */
function ProfileMenu({ user }: { user: User }) {
  const safety = useSafetyActions(user);
  if (safety.isMe) return null;
  return (
    <Pressable
      accessibilityLabel={`More options for @${user.username}`}
      hitSlop={10}
      onPress={() => actionSheet.show({ title: `@${user.username}`, options: safety.options })}>
      <Ellipsis size={24} color={Colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  missing: { textAlign: 'center', padding: Spacing.five },
});
