import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/logo';
import { ProfileForm } from '@/components/profile-form';
import { AppText } from '@/components/ui/app-text';
import { ErrorView, LoadingView } from '@/components/ui/states';
import { Colors, Spacing } from '@/constants/theme';
import { signOut } from '@/lib/auth';
import { useMe } from '@/lib/queries';

/** First run after sign-up: pick a username, country and club (GP-031). */
export default function Onboarding() {
  const { data: me, isPending, refetch } = useMe();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <LogoMark width={56} glow={false} pulseColor={Colors.primary} ballBody={Colors.primary} ballPanel={Colors.iceWhite} />
        <AppText variant="title">Set up your profile</AppText>
        <AppText color={Colors.textSecondary}>Fans will know you by this. You can change it later.</AppText>
      </View>
      {me ? (
        <ProfileForm user={me} submitLabel="Start watching" onSaved={() => router.replace('/')} />
      ) : isPending ? (
        <LoadingView />
      ) : (
        <ErrorView
          message="We couldn't load your account."
          onRetry={() => refetch()}
        />
      )}
      <AppText variant="caption" color={Colors.textSecondary} style={styles.switch} onPress={() => signOut().then(() => router.replace('/'))}>
        Not you? Sign out
      </AppText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four, gap: Spacing.one },
  switch: { textAlign: 'center', padding: Spacing.three },
});
