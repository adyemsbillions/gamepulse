import { Camera, Clock, Hash, Upload } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Colors, Radius, Spacing } from '@/constants/theme';

/** Upload flow placeholder — capture/pick, trim and publish land in roadmap Stage 2 (Video). */
export default function CreateScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <AppText variant="display" color={Colors.primary}>
          New Moment
        </AppText>
        <AppText color={Colors.textSecondary}>
          Share a football Moment with your Fans.
        </AppText>

        <View style={styles.actions}>
          <Button
            label="Record a Reel"
            icon={<Camera size={20} color={Colors.iceWhite} />}
            disabled
          />
          <Button
            label="Upload from gallery"
            variant="secondary"
            icon={<Upload size={20} color={Colors.primary} />}
            disabled
          />
          <AppText variant="caption" color={Colors.textSecondary} style={styles.soon}>
            Uploading is coming soon.
          </AppText>
        </View>

        <View style={styles.tips}>
          <Tip icon={<Clock size={18} color={Colors.primary} />} text="Keep it under 60 seconds" />
          <Tip icon={<Hash size={18} color={Colors.primary} />} text="Add hashtags so fans can find it" />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Tip({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.tip}>
      {icon}
      <AppText variant="caption">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: Spacing.four, gap: Spacing.two },
  actions: { gap: Spacing.three, marginTop: Spacing.five },
  soon: { textAlign: 'center' },
  tips: {
    marginTop: 'auto',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  tip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
