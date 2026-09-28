import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile-view';
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
  Alert.alert('Account', undefined, [
    { text: 'Edit profile', onPress: () => router.push('/edit-profile') },
    ...(isLive
      ? [{ text: 'Sign out', style: 'destructive' as const, onPress: () => void signOut() }]
      : []),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
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
