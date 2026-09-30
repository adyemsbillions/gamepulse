import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { extractHashtags } from '@/lib/data/source';

const TOKEN = /([#@][A-Za-z0-9_.]+)/g;

/**
 * Caption with tappable #hashtags and @mentions. Tags the creator added outside the caption
 * are listed underneath, so nothing is shown twice.
 */
export function ReelCaption({ caption, hashtags }: { caption: string; hashtags: string[] }) {
  const inCaption = new Set(extractHashtags(caption));
  const extra = hashtags.filter((t) => !inCaption.has(t));

  return (
    <>
      {!!caption && (
        <AppText variant="body" color={Colors.iceWhite} style={styles.shadow} numberOfLines={3}>
          {caption.split(TOKEN).map((part, i) => {
            if (i % 2 === 0) return part;
            const name = part.slice(1).replace(/\.+$/, '');
            const open = () =>
              part.startsWith('#')
                ? router.push(`/hashtag/${name.toLowerCase()}`)
                : router.push(`/user/${name.toLowerCase()}`);
            return (
              <Text key={i} onPress={open} style={styles.token} suppressHighlighting>
                {part}
              </Text>
            );
          })}
        </AppText>
      )}
      {extra.length > 0 && (
        <View style={styles.tags}>
          {extra.map((tag) => (
            <Pressable key={tag} hitSlop={4} onPress={() => router.push(`/hashtag/${tag}`)}>
              <AppText variant="bodyBold" color={Colors.iceWhite} style={styles.shadow}>
                #{tag}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  token: { fontFamily: Fonts.semibold },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  shadow: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
