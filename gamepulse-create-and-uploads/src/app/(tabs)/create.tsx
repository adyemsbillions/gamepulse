import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Camera, ChevronRight, Clock, Copyright, Film, Smartphone } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Colors, Radius, Spacing, TabBarHeight } from '@/constants/theme';
import { requireSignIn } from '@/lib/auth';
import { MAX_MOMENT_SECONDS, MAX_UPLOAD_BYTES } from '@/lib/data/source';
import { draftVideo, type PickedVideo } from '@/lib/uploads';

type Source = 'camera' | 'library';

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['videos'],
  videoMaxDuration: MAX_MOMENT_SECONDS,
  // iOS shows its trim bar; Android's picker has none, so long clips are refused below.
  allowsEditing: Platform.OS === 'ios',
  quality: 1,
};

async function pickVideo(source: Source): Promise<PickedVideo | null> {
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow GamePulse to use the camera to record a Moment.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
      return null;
    }
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const durationSec = asset.duration ? asset.duration / 1000 : null;
  if (durationSec && durationSec > MAX_MOMENT_SECONDS + 1) {
    Alert.alert(
      'Clip is too long',
      `Moments can be up to ${MAX_MOMENT_SECONDS} seconds. This one is ${Math.round(durationSec)} s. Trim it in your gallery and try again.`,
    );
    return null;
  }
  if (asset.fileSize && asset.fileSize > MAX_UPLOAD_BYTES) {
    Alert.alert('Clip is too big', 'Pick a clip under 300 MB.');
    return null;
  }

  return {
    uri: asset.uri,
    durationSec,
    fileSize: asset.fileSize ?? asset.file?.size ?? null,
    mimeType: asset.mimeType ?? asset.file?.type ?? 'video/mp4',
    width: asset.width,
    height: asset.height,
    file: asset.file,
  };
}

export default function CreateScreen() {
  const [busy, setBusy] = useState<Source | null>(null);
  const navigation = useNavigation<{ navigate: (tab: string) => void }>();

  // After posting, show Profile: the upload banner tracks progress there.
  useFocusEffect(
    useCallback(() => {
      if (draftVideo.consumePosted()) navigation.navigate('profile');
    }, [navigation]),
  );

  const start = async (source: Source) => {
    if (busy || !requireSignIn()) return;
    setBusy(source);
    try {
      const video = await pickVideo(source);
      if (video) {
        draftVideo.set(video);
        router.push('/compose');
      }
    } catch {
      Alert.alert("Couldn't open that", 'Try again, or pick a different clip.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="display" color={Colors.primary}>
          New Moment
        </AppText>
        <AppText color={Colors.textSecondary}>
          That skill, that save, that last-minute winner. Share it while it&apos;s hot.
        </AppText>

        <View style={styles.sources}>
          <SourceCard
            title="Record"
            detail={`Film it now, up to ${MAX_MOMENT_SECONDS} seconds`}
            icon={<Camera size={26} color={Colors.pulse} strokeWidth={2.2} />}
            loading={busy === 'camera'}
            onPress={() => start('camera')}
            featured
          />
          <SourceCard
            title="Upload"
            detail="Pick a clip from your gallery"
            icon={<Film size={26} color={Colors.primary} strokeWidth={2.2} />}
            loading={busy === 'library'}
            onPress={() => start('library')}
          />
        </View>

        <View style={styles.rules}>
          <AppText variant="bodyBold">Before you post</AppText>
          <Rule icon={<Clock size={18} color={Colors.primary} />} text={`Up to ${MAX_MOMENT_SECONDS} seconds.`} />
          <Rule icon={<Smartphone size={18} color={Colors.primary} />} text="Hold your phone upright. Vertical clips fill the screen." />
          <Rule
            icon={<Copyright size={18} color={Colors.primary} />}
            text="Only post clips you filmed or have the right to share. TV broadcast footage gets taken down."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SourceCard({
  title,
  detail,
  icon,
  loading,
  featured,
  onPress,
}: {
  title: string;
  detail: string;
  icon: ReactNode;
  loading: boolean;
  featured?: boolean;
  onPress: () => void;
}) {
  const fg = featured ? Colors.iceWhite : Colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, featured && styles.cardFeatured, pressed && styles.pressed]}>
      <View style={[styles.cardIcon, featured && styles.cardIconFeatured]}>{icon}</View>
      <View style={styles.cardText}>
        <AppText variant="title" color={fg}>
          {title}
        </AppText>
        <AppText variant="caption" color={featured ? Colors.powderBlue : Colors.textSecondary}>
          {detail}
        </AppText>
      </View>
      {loading ? (
        <ActivityIndicator color={featured ? Colors.pulse : Colors.primary} />
      ) : (
        <ChevronRight size={22} color={featured ? Colors.powderBlue : Colors.textSecondary} />
      )}
    </Pressable>
  );
}

function Rule({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={styles.rule}>
      {icon}
      <AppText variant="caption" style={styles.ruleText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.four, gap: Spacing.two, paddingBottom: TabBarHeight + Spacing.six },
  sources: { gap: Spacing.three, marginTop: Spacing.four },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardFeatured: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  cardIconFeatured: { backgroundColor: Colors.primaryDeep },
  cardText: { flex: 1, gap: 2 },
  rules: {
    marginTop: Spacing.five,
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceMuted,
  },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  ruleText: { flex: 1 },
});
