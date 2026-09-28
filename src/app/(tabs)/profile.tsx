import { Settings } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileView } from '@/components/profile-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors } from '@/constants/theme';
import { getCurrentUser } from '@/lib/api';

export default function MyProfile() {
  const me = getCurrentUser();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ProfileView
        user={me}
        header={
          <ScreenHeader
            title="Profile"
            right={
              <Pressable accessibilityLabel="Settings" hitSlop={10}>
                <Settings size={24} color={Colors.text} />
              </Pressable>
            }
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
});
