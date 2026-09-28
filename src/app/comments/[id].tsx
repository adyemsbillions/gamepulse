import { router, useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PulseBall } from '@/components/brand/pulse-ball';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { LoadingView } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { UserFacingError } from '@/lib/data/source';
import { formatCount, timeAgo } from '@/lib/format';
import { useAddComment, useComments, useMe, useReel } from '@/lib/queries';
import { useSessionUserId } from '@/lib/session';
import type { Comment } from '@/lib/types';

export default function CommentsSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: reel } = useReel(id);
  const loaded = useComments(id);
  const uid = useSessionUserId();
  const { data: me } = useMe();
  const post = useAddComment(id);
  const [draft, setDraft] = useState('');

  const comments = loaded.data ?? [];
  const total = Math.max(reel?.comments ?? 0, comments.length);
  const canPost = draft.trim().length > 0 && !post.isPending;

  const submit = () => {
    const text = draft.trim();
    if (!text || post.isPending) return;
    post.mutate(text, {
      onSuccess: () => setDraft(''),
      onError: (e) =>
        Alert.alert(
          "Comment didn't post",
          e instanceof UserFacingError ? e.message : 'Check your connection and try again.',
        ),
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppText variant="heading" style={styles.title}>
        {formatCount(total)} {total === 1 ? 'comment' : 'comments'}
      </AppText>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CommentRow comment={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          loaded.isPending ? (
            <LoadingView style={styles.loading} />
          ) : (
            <AppText
              color={Colors.textSecondary}
              style={styles.empty}
              onPress={loaded.isError ? () => loaded.refetch() : undefined}>
              {loaded.isError ? "Couldn't load comments. Tap to try again." : 'Be the first to comment.'}
            </AppText>
          )
        }
      />
      <View style={[styles.composer, { paddingBottom: insets.bottom + Spacing.two }]}>
        {uid === null ? (
          <Button label="Sign in to comment" onPress={() => router.push('/sign-in')} style={styles.signIn} />
        ) : (
          <>
            {me && <Avatar user={me} size={34} />}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment…"
              placeholderTextColor={Colors.textSecondary}
              style={styles.input}
              onSubmitEditing={submit}
              returnKeyType="send"
              maxLength={500}
              editable={!post.isPending}
            />
            <Pressable accessibilityLabel="Post comment" onPress={submit} disabled={!canPost} hitSlop={8}>
              {post.isPending ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Send size={22} color={canPost ? Colors.primary : Colors.powderBlue} />
              )}
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentRow({ comment }: { comment: Comment }) {
  const author = comment.author;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          router.back();
          router.push(`/user/${author.username}`);
        }}>
        <Avatar user={author} size={36} />
      </Pressable>
      <View style={styles.body}>
        <AppText variant="label" color={Colors.textSecondary}>
          @{author.username} · {timeAgo(comment.createdAt)}
        </AppText>
        <AppText variant="body">{comment.text}</AppText>
      </View>
      <View style={styles.cheer}>
        <PulseBall size={16} body="transparent" panel={Colors.textSecondary} />
        <AppText variant="label" color={Colors.textSecondary}>
          {formatCount(comment.cheers)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  title: { textAlign: 'center', paddingTop: Spacing.four, paddingBottom: Spacing.two },
  list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  empty: { textAlign: 'center', padding: Spacing.five },
  loading: { paddingVertical: Spacing.five },
  signIn: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.two + 2 },
  body: { flex: 1, gap: 2 },
  cheer: { alignItems: 'center', gap: 2, paddingTop: Spacing.one },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceMuted,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.text,
  },
});
