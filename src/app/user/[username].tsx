import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile-view';
import { AppText } from '@/components/ui/app-text';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Spacing } from '@/constants/theme';
import { getUserByUsername } from '@/lib/api';

export default function UserScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const user = getUserByUsername(username);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {user ? (
        <ProfileView user={user} header={<ScreenHeader title={`@${user.username}`} back />} />
      ) : (
        <>
          <ScreenHeader title="Profile" back />
          <AppText color={Colors.textSecondary} style={styles.missing}>
            This GameMaker doesn&apos;t exist.
          </AppText>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  missing: { textAlign: 'center', padding: Spacing.five },
});
