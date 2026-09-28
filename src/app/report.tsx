import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { ReportReason } from '@/lib/data/source';
import { useReport } from '@/lib/queries';

const REASONS: { label: string; value: ReportReason }[] = [
  { label: 'Spam or misleading', value: 'spam' },
  { label: 'Violence or dangerous acts', value: 'violence' },
  { label: 'Hate speech', value: 'hate' },
  { label: 'Bullying or harassment', value: 'abuse' },
  { label: 'Nudity or sexual content', value: 'nudity' },
  { label: 'Copyright / broadcast rights', value: 'copyright' },
  { label: 'Scam, fraud or something else', value: 'other' },
];

/** Report flow (GP-035): saved to `reports` for the moderation queue. */
export default function ReportScreen() {
  const { reelId } = useLocalSearchParams<{ reelId?: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const report = useReport();

  const submit = () => {
    if (!reelId || !reason) return;
    report.mutate(
      { reelId, reason },
      {
        onSuccess: () => {
          Alert.alert('Thanks for reporting', 'Our moderators will review this Moment.');
          router.back();
        },
        onError: () => Alert.alert("Report didn't send", 'Check your connection and try again.'),
      },
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScreenHeader title="Report Moment" back />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText color={Colors.textSecondary}>
          Why are you reporting this? Your report is anonymous.
        </AppText>
        <View style={styles.list}>
          {REASONS.map(({ label, value }) => {
            const selected = value === reason;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setReason(value)}
                style={[styles.option, selected && styles.optionSelected]}>
                <AppText variant="bodyBold" color={selected ? Colors.primary : Colors.text}>
                  {label}
                </AppText>
                {selected && <Check size={20} color={Colors.primary} />}
              </Pressable>
            );
          })}
        </View>
        <Button
          label={report.isPending ? 'Sending…' : 'Submit report'}
          onPress={submit}
          disabled={!reason || report.isPending}
        />
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
