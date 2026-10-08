import { Image } from 'expo-image';
import { Alert, Platform, Pressable, StyleSheet, ToastAndroid } from 'react-native';

import { Sticker, stickerFor } from '@/components/stickers';
import { actionSheet } from '@/components/ui/action-sheet';
import { Colors, Radius } from '@/constants/theme';
import { requireSignIn } from '@/lib/auth';
import { UserFacingError } from '@/lib/data/source';
import { useSavedStickers, useSetSavedSticker } from '@/lib/queries';
import type { CommentMedia } from '@/lib/types';

const GIF_WIDTH = 170;

/**
 * The comments open as a native sheet, which covers the app's own toast; Android's system toast
 * shows above it. iOS has no system toast, so it gets a short alert.
 */
function notify(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert(message);
}

/** A comment's sticker or GIF. Long-press to keep it in (or take it out of) My stickers. */
export function CommentMediaView({ media }: { media: CommentMedia }) {
  const saved = useSavedStickers().data ?? [];
  const isSaved = saved.some((m) => m.url === media.url);
  const setSaved = useSetSavedSticker();

  const menu = () => {
    if (!requireSignIn()) return;
    actionSheet.show({
      title: media.kind === 'sticker' ? 'Sticker' : 'GIF',
      options: [
        {
          label: isSaved ? 'Remove from My stickers' : 'Save to My stickers',
          destructive: isSaved,
          onPress: () =>
            setSaved.mutate(
              { media, on: !isSaved },
              {
                onSuccess: () => notify(isSaved ? 'Removed from My stickers' : 'Saved to My stickers ⭐'),
                onError: (e) => notify(e instanceof UserFacingError ? e.message : "Couldn't save that. Try again."),
              },
            ),
        },
      ],
    });
  };

  if (media.kind === 'sticker' && media.url.startsWith('gp:')) {
    const sticker = stickerFor(media.url);
    return (
      <Pressable onLongPress={menu} delayLongPress={350} accessibilityHint="Long-press to save" style={styles.sticker}>
        <Sticker id={sticker?.id ?? media.url.slice(3)} size={92} />
      </Pressable>
    );
  }

  if (media.kind === 'sticker') {
    // A GIPHY sticker: transparent and animated, shown without a frame.
    return (
      <Pressable onLongPress={menu} delayLongPress={350} accessibilityLabel="Sticker" accessibilityHint="Long-press to save">
        <Image source={media.url} style={styles.giphySticker} contentFit="contain" autoplay />
      </Pressable>
    );
  }

  const ratio = media.width && media.height ? media.height / media.width : 0.75;
  return (
    <Pressable onLongPress={menu} delayLongPress={350} accessibilityLabel="GIF" accessibilityHint="Long-press to save">
      <Image
        source={media.url}
        style={[styles.gif, { width: GIF_WIDTH, height: Math.min(Math.round(GIF_WIDTH * ratio), 260) }]}
        contentFit="cover"
        autoplay
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sticker: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 4 },
  giphySticker: { width: 120, height: 120, marginTop: 2 },
  gif: { borderRadius: Radius.md, backgroundColor: Colors.surfaceMuted, marginTop: 4 },
});
