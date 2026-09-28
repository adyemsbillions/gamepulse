import { router, useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PulseBall } from '@/components/brand/pulse-ball';
import { AppText } from '@/components/ui/app-text';
import { Avatar } from '@/components/ui/avatar';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { getComments, getCurrentUser, getReel, getUser } from '@/lib/api';
import { engagement, useEngagement } from '@/lib/engagement-store';
import { formatCount, timeAgo } from '@/lib/format';
import type { Comment } from '@/lib/types';

export default function CommentsSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const reel = getReel(id);
  const newComments = useEngagement((s) => s.newComments);
  const [draft, setDraft] = useState('');

  const comments = [...newComments.filter((c) => c.reelId === id).reverse(), ...getComments(id)];
  const total = (reel?.comments ?? 0) + newComments.filter((c) => c.reelId === id).length;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    engagement.addComment(id, text);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppText variant="heading" style={styles.title}>
        {formatCount(total)} comments
      </AppText>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CommentRow comment={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <AppText color={Colors.textSecondary} style={styles.empty}>
            Be the first to comment.
          </AppText>
        }
      />
      <View style={[styles.composer, { paddingBottom: insets.bottom + Spacing.two }]}>
        <Avatar user={getCurrentUser()} size={34} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          placeholderTextColor={Colors.textSecondary}
          style={styles.input}
          onSubmitEditing={submit}
          returnKeyType="send"
          maxLength={500}
        />
        <Pressable accessibilityLabel="Post comment" onPress={submit} disabled={!draft.trim()} hitSlop={8}>
          <Send size={22} color={draft.trim() ? Colors.primary : Colors.powderBlue} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentRow({ comment }: { comment: Comment }) {
  const author = getUser(comment.userId);
  if (!author) return null;

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
