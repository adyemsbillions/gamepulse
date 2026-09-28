import { useLocalSearchParams } from 'expo-router';
import { Hash } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReelGrid } from '@/components/reel-grid';
import { AppText } from '@/components/ui/app-text';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getFeed, getHashtag } from '@/lib/api';
import { formatCount } from '@/lib/format';

export default function HashtagScreen() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const hashtag = getHashtag(tag);
  const reels = getFeed({ hashtag: hashtag.name });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={`#${hashtag.name}`} back />
      <ScrollView>
        <View style={styles.hero}>
          <View style={styles.icon}>
            <Hash size={34} color={Colors.iceWhite} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="title">#{hashtag.name}</AppText>
            <AppText variant="caption" color={Colors.textSecondary}>
              {formatCount(hashtag.usageCount)} Moments
            </AppText>
          </View>
        </View>
        {reels.length > 0 ? (
          <ReelGrid reels={reels} filter={{ hashtag: hashtag.name }} />
        ) : (
          <AppText color={Colors.textSecondary} style={styles.empty}>
            No Moments with this hashtag yet.
          </AppText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  hero: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  icon: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { textAlign: 'center', padding: Spacing.five },
});
