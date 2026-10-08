import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Colors, Spacing } from '@/constants/theme';

/** A grid that failed to load: what went wrong (so a screenshot tells us why) and a retry. */
export function FeedError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return (
    <View style={styles.box}>
      <AppText color={Colors.textSecondary} style={styles.center}>
        Couldn&apos;t load Moments.
      </AppText>
      {!!detail && (
        <AppText variant="label" color={Colors.textSecondary} style={styles.center} numberOfLines={3}>
          {detail}
        </AppText>
      )}
      <Button label="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: Spacing.two, padding: Spacing.five },
  center: { textAlign: 'center' },
});
