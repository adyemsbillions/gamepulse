import { useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './app-text';

import { Colors, Radius, Spacing } from '@/constants/theme';

export type ActionSheetOption = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

type Sheet = { title?: string; message?: string; options: ActionSheetOption[] };

let current: Sheet | null = null;
const listeners = new Set<() => void>();
const set = (next: Sheet | null) => {
  current = next;
  listeners.forEach((l) => l());
};

/**
 * A bottom sheet of choices, opened from anywhere like `Alert.alert`. Use it instead of Alert
 * when there may be more than three choices (Android's Alert shows at most three buttons).
 * Rendered once by <ActionSheetHost /> in the root layout. Cancel is added automatically.
 */
export const actionSheet = {
  show: (sheet: Sheet) => set(sheet),
  hide: () => set(null),
};

export function ActionSheetHost() {
  const sheet = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => current,
  );
  const insets = useSafeAreaInsets();

  const choose = (option: ActionSheetOption) => {
    set(null);
    option.onPress();
  };

  return (
    <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => set(null)} statusBarTranslucent>
      <Pressable accessibilityLabel="Close menu" style={styles.backdrop} onPress={() => set(null)} />
      {sheet && (
        <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.two }]}>
          {(sheet.title || sheet.message) && (
            <View style={styles.header}>
              {sheet.title && <AppText variant="bodyBold">{sheet.title}</AppText>}
              {sheet.message && (
                <AppText variant="caption" color={Colors.textSecondary} style={styles.center}>
                  {sheet.message}
                </AppText>
              )}
            </View>
          )}
          {sheet.options.map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              onPress={() => choose(option)}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
              <AppText variant="bodyBold" color={option.destructive ? Colors.danger : Colors.text}>
                {option.label}
              </AppText>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => set(null)}
            style={({ pressed }) => [styles.option, styles.cancel, pressed && styles.pressed]}>
            <AppText variant="bodyBold" color={Colors.textSecondary}>
              Cancel
            </AppText>
          </Pressable>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8, 29, 77, 0.45)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    paddingTop: Spacing.two,
  },
  header: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  center: { textAlign: 'center' },
  option: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  cancel: { borderBottomWidth: 0, marginTop: Spacing.one },
  pressed: { backgroundColor: Colors.surfaceMuted },
});
