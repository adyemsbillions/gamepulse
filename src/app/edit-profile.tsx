import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileForm } from '@/components/profile-form';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ErrorView, LoadingView } from '@/components/ui/states';
import { Colors } from '@/constants/theme';
import { useMe } from '@/lib/queries';

export default function EditProfile() {
  const { data: me, isPending, refetch } = useMe();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Edit profile" back />
      {me ? (
        <ProfileForm user={me} submitLabel="Save changes" onSaved={() => router.back()} />
      ) : isPending ? (
        <LoadingView />
      ) : (
        <ErrorView onRetry={() => refetch()} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
});
