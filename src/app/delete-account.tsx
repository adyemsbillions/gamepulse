import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { data } from '@/lib/api';
import { forgetDeletedAccount } from '@/lib/auth';
import { UserFacingError } from '@/lib/data/source';
import { useMe } from '@/lib/queries';

const GONE = [
  'Your profile, username and photos',
  'Every Moment you posted, and its video',
  'Your comments, Cheers, replays and saves',
  'Who you support and who supports you',
  'Your notifications, blocks and mutes',
];

/** Account deletion, required by Google Play and the App Store. */
export default function DeleteAccount() {
  const { data: me } = useMe();
  const remove = useMutation({ mutationFn: () => data.deleteAccount() });

  const confirm = () =>
    Alert.alert('Delete your account?', 'This is permanent. Your Moments and everything else listed will be gone for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(undefined, {
            onSuccess: async () => {
              await forgetDeletedAccount();
              router.replace('/');
              Alert.alert('Account deleted', 'Thanks for being part of GamePulse.');
            },
            onError: (e) =>
              Alert.alert(
                "Couldn't delete your account",
                e instanceof UserFacingError ? e.message : 'Check your connection and try again.',
              ),
          }),
      },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Delete account" back />
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title">{me ? `Delete @${me.username}?` : 'Delete your account?'}</AppText>
        <AppText color={Colors.textSecondary}>
          Deleting your account removes it from GamePulse permanently. It can&apos;t be undone.
        </AppText>

        <View style={styles.box}>
          <AppText variant="bodyBold">What gets deleted</AppText>
          {GONE.map((line) => (
            <AppText key={line} variant="body">
              {'•'} {line}
            </AppText>
          ))}
        </View>

        <AppText variant="caption" color={Colors.textSecondary}>
          Copies other people already shared outside the app, and records we must keep by law, may
          remain. Your Google account itself isn&apos;t affected.
        </AppText>

        <Button
          label={remove.isPending ? 'Deleting…' : 'Delete my account'}
          onPress={confirm}
          disabled={remove.isPending || !me}
          style={styles.danger}
          labelColor={Colors.iceWhite}
        />
        <Button label="Keep my account" variant="secondary" onPress={() => router.back()} disabled={remove.isPending} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.four, gap: Spacing.three },
  box: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  danger: { backgroundColor: Colors.danger, borderColor: Colors.danger, marginTop: Spacing.two },
});
