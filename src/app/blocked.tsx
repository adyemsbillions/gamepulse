import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyView, ErrorView, LoadingView } from '@/components/ui/states';
import { Colors, Spacing } from '@/constants/theme';
import { useBlockedUsers } from '@/lib/queries';
import type { User } from '@/lib/types';
import { useSafetyActions } from '@/lib/use-safety-actions';

/** Everyone you've blocked, with a way to unblock them. */
export default function BlockedAccounts() {
  const { data, isPending, isError, refetch } = useBlockedUsers();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Blocked accounts" back />
      {isPending ? (
        <LoadingView />
      ) : isError ? (
        <ErrorView onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => <BlockedRow user={item} />}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={
            data.length > 0 ? (
              <AppText variant="caption" color={Colors.textSecondary} style={styles.note}>
                Blocked people can&apos;t see your Moments or comments, or cheer, comment on or support them.
                They aren&apos;t told.
              </AppText>
            ) : null
          }
          ListEmptyComponent={<EmptyView message="You haven't blocked anyone." />}
          contentContainerStyle={data.length === 0 ? styles.fill : undefined}
        />
      )}
    </SafeAreaView>
  );
}

function BlockedRow({ user }: { user: User }) {
  const safety = useSafetyActions(user);
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="link" style={styles.who} onPress={() => router.push(`/user/${user.username}`)}>
        <Avatar user={user} size={44} />
        <View style={styles.flex}>
          <AppText variant="bodyBold">@{user.username}</AppText>
          <AppText variant="caption" color={Colors.textSecondary} numberOfLines={1}>
            {user.displayName}
          </AppText>
        </View>
      </Pressable>
      <Button
        label={safety.busy ? '…' : 'Unblock'}
        variant="secondary"
        disabled={safety.busy}
        onPress={safety.unblock}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  fill: { flexGrow: 1 },
  flex: { flex: 1 },
  note: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
});
