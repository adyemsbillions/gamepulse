import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import { Hash, Reply, Trophy, Volume2, VolumeX, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { EmptyView } from '@/components/ui/states';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { isLive } from '@/lib/api';
import { extractHashtags, MAX_HASHTAGS } from '@/lib/data/source';
import { useTrendingHashtags } from '@/lib/queries';
import { draftVideo, uploads, type PickedVideo } from '@/lib/uploads';

const CAPTION_MAX = 2200;
const PREVIEW_WIDTH = 124;

export default function ComposeScreen() {
  const [video] = useState(() => draftVideo.get());

  if (!video) {
    return (
      <SafeAreaView style={styles.container}>
        <Header />
        <EmptyView message="Pick a clip on the Create tab first." />
      </SafeAreaView>
    );
  }
  return <Composer video={video} />;
}

function Header() {
  return (
    <View style={styles.header}>
      <Pressable accessibilityLabel="Discard" hitSlop={12} onPress={() => router.back()}>
        <X size={26} color={Colors.text} />
      </Pressable>
      <AppText variant="title" style={styles.headerTitle}>
        New Moment
      </AppText>
    </View>
  );
}

function Composer({ video }: { video: PickedVideo }) {
  // A challenge's hashtag or the Moment being responded to, from "Join challenge" / "Respond".
  const [preset] = useState(() => draftVideo.getPreset());
  const [caption, setCaption] = useState(preset?.caption ?? '');
  const input = useRef<TextInput>(null);
  const tags = useMemo(() => extractHashtags(caption), [caption]);
  const trending = useTrendingHashtags().data ?? [];
  const suggestions = trending.filter((h) => !tags.includes(h.name)).slice(0, 8);

  const addTag = (name: string) => {
    if (tags.length >= MAX_HASHTAGS) return;
    setCaption((c) => `${c}${c && !/\s$/.test(c) ? ' ' : ''}#${name} `.slice(0, CAPTION_MAX));
  };

  const post = () => {
    uploads.post(video, caption.trim(), tags, preset?.replyTo?.reelId ?? null);
    draftVideo.set(null);
    draftVideo.setPreset(null);
    draftVideo.markPosted();
    // Back to the Create tab, which hands over to Profile (see create.tsx).
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Header />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {preset && (
            <View style={styles.preset}>
              {preset.replyTo ? <Reply size={16} color={Colors.primary} /> : <Trophy size={16} color={Colors.primary} />}
              <AppText variant="bodyBold" color={Colors.primary} style={styles.flex}>
                {preset.label}
              </AppText>
            </View>
          )}
          <View style={styles.top}>
            <Preview video={video} />
            <View style={styles.captionBox}>
              <TextInput
                ref={input}
                value={caption}
                onChangeText={(t) => setCaption(t.slice(0, CAPTION_MAX))}
                placeholder={'What happened? Add #hashtags and @mention your people.'}
                placeholderTextColor={Colors.textSecondary}
                multiline
                autoFocus={Platform.OS !== 'web'}
                style={styles.caption}
              />
              <AppText variant="label" color={Colors.textSecondary} style={styles.count}>
                {caption.length}/{CAPTION_MAX}
              </AppText>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionTitle}>
              <Hash size={16} color={Colors.primary} />
              <AppText variant="bodyBold">Hashtags</AppText>
              <AppText variant="label" color={Colors.textSecondary}>
                {tags.length}/{MAX_HASHTAGS}
              </AppText>
            </View>
            {tags.length > 0 ? (
              <View style={styles.chips}>
                {tags.map((t) => (
                  <View key={t} style={[styles.chip, styles.chipOn]}>
                    <AppText variant="label" color={Colors.iceWhite}>
                      #{t}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : (
              <AppText variant="caption" color={Colors.textSecondary}>
                Type # in your caption, or tap a trending one. Fans find Moments through hashtags.
              </AppText>
            )}
            {suggestions.length > 0 && tags.length < MAX_HASHTAGS && (
              <>
                <AppText variant="label" color={Colors.textSecondary} style={styles.trendingLabel}>
                  TRENDING
                </AppText>
                <View style={styles.chips}>
                  {suggestions.map((h) => (
                    <Pressable
                      key={h.name}
                      accessibilityLabel={`Add hashtag ${h.name}`}
                      onPress={() => addTag(h.name)}
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
                      <AppText variant="label" color={Colors.primary}>
                        #{h.name}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>

          <AppText variant="caption" color={Colors.textSecondary} style={styles.legal}>
            {isLive
              ? 'By posting, you confirm you filmed this clip or have the right to share it.'
              : 'Sample mode: this Moment stays on this device and is gone when the app restarts.'}
          </AppText>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Post Moment" onPress={post} style={styles.post} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Preview({ video }: { video: PickedVideo }) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer({ uri: video.uri }, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  const toggleSound = () => {
    const next = !muted;
    setPlayerMuted(player, next);
    setMuted(next);
  };

  const ratio = video.width > 0 && video.height > 0 ? video.width / video.height : 9 / 16;

  return (
    <View style={[styles.preview, { aspectRatio: Math.min(Math.max(ratio, 9 / 16), 1) }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <Pressable
        accessibilityLabel={muted ? 'Play sound' : 'Mute'}
        hitSlop={8}
        onPress={toggleSound}
        style={styles.sound}>
        {muted ? <VolumeX size={16} color={Colors.iceWhite} /> : <Volume2 size={16} color={Colors.iceWhite} />}
      </Pressable>
      {!!video.durationSec && (
        <View style={styles.duration}>
          <AppText variant="label" color={Colors.iceWhite}>
            {formatDuration(video.durationSec)}
          </AppText>
        </View>
      )}
    </View>
  );
}

// The player is an imperative native object; mutate it outside render scope.
function setPlayerMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerTitle: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four },
  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  top: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  preview: {
    width: PREVIEW_WIDTH,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.primaryDeep,
  },
  sound: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    padding: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.scrim,
  },
  duration: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.sm,
    backgroundColor: Colors.scrim,
  },
  captionBox: {
    flex: 1,
    minHeight: PREVIEW_WIDTH * (16 / 9),
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.three,
  },
  caption: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
    textAlignVertical: 'top',
    padding: 0,
  },
  count: { alignSelf: 'flex-end', marginTop: Spacing.two },
  section: { gap: Spacing.two },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  trendingLabel: { marginTop: Spacing.two, letterSpacing: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pressed: { opacity: 0.7 },
  legal: { textAlign: 'center' },
  footer: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  post: { paddingVertical: 14 },
});
