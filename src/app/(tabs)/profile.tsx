import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile-view';
import { actionSheet } from '@/components/ui/action-sheet';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ErrorView, LoadingView } from '@/components/ui/states';
import { Colors, Spacing } from '@/constants/theme';
import { isLive } from '@/lib/api';
import { signOut } from '@/lib/auth';
import { useMe } from '@/lib/queries';
import { useSessionUserId } from '@/lib/session';

export default function MyProfile() {
  const uid = useSessionUserId();
  const { data: me, isPending, isError, refetch } = useMe();

  const header = (
    <ScreenHeader
      title="Profile"
      right={
        me ? (
          <Pressable accessibilityLabel="Account settings" hitSlop={10} onPress={() => accountMenu()}>
            <Settings size={24} color={Colors.text} />
          </Pressable>
        ) : undefined
      }
    />
  );

  if (me) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ProfileView user={me} header={header} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {header}
      {uid === null ? (
        <SignedOut />
      ) : isPending ? (
        <LoadingView />
      ) : isError ? (
        <ErrorView onRetry={() => refetch()} />
      ) : (
        <ErrorView message="We couldn't find your profile yet." onRetry={() => refetch()} />
      )}
    </SafeAreaView>
  );
}

function accountMenu() {
  actionSheet.show({
    title: 'Account',
    options: [
      { label: 'Edit profile', onPress: () => router.push('/edit-profile') },
      { label: 'Blocked accounts', onPress: () => router.push('/blocked') },
      ...(isLive ? [{ label: 'Sign out', destructive: true, onPress: () => void signOut() }] : []),
    ],
  });
}

function SignedOut() {
  return (
    <View style={styles.signedOut}>
      <AppText variant="title" style={styles.center}>
        Your football, your Moments
      </AppText>
      <AppText color={Colors.textSecondary} style={styles.center}>
        Sign in to post Moments, collect Fans and support the GameMakers you rate.
      </AppText>
      <Button label="Sign in with Google" onPress={() => router.push('/sign-in')} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  signedOut: { flex: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  center: { textAlign: 'center' },
  cta: { marginTop: Spacing.two },
});
