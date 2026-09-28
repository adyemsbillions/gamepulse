import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Radius, Spacing } from '@/constants/theme';

const REASONS = [
  'Spam or misleading',
  'Violence or dangerous acts',
  'Hate speech or harassment',
  'Nudity or sexual content',
  'Copyright / broadcast rights',
  'Scam or fraud',
  'Something else',
];

/** Report flow. The backend will persist this to `reports` for the admin moderation queue. */
export default function ReportScreen() {
  const { reelId } = useLocalSearchParams<{ reelId?: string }>();
  const [reason, setReason] = useState<string | null>(null);

  const submit = () => {
    // TODO(backend): insert into reports { reporter_id, object_type: 'video', object_id: reelId, reason }
    console.log('report', { reelId, reason });
    Alert.alert('Thanks for reporting', 'Our moderators will review this Moment.');
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Report Moment" back />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText color={Colors.textSecondary}>
          Why are you reporting this? Your report is anonymous.
        </AppText>
        <View style={styles.list}>
          {REASONS.map((r) => {
            const selected = r === reason;
            return (
              <Pressable
                key={r}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setReason(r)}
                style={[styles.option, selected && styles.optionSelected]}>
                <AppText variant="bodyBold" color={selected ? Colors.primary : Colors.text}>
                  {r}
                </AppText>
                {selected && <Check size={20} color={Colors.primary} />}
              </Pressable>
            );
          })}
        </View>
        <Button label="Submit report" onPress={submit} disabled={!reason} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.three, gap: Spacing.three },
  list: { gap: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionSelected: { borderColor: Colors.primary, backgroundColor: Colors.surfaceMuted },
});
