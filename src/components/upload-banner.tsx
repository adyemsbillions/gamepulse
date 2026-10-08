import { router } from 'expo-router';
import { AlertCircle, CheckCircle2, RotateCcw, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { PulseLoader } from '@/components/ui/states';
import { Colors, Radius, Spacing, TabBarHeight } from '@/constants/theme';
import { useMe } from '@/lib/queries';
import { uploads, useUploads, type UploadJob } from '@/lib/uploads';

const AUTO_HIDE_MS = 8_000;

/** Floating card above the tab bar while a Moment posts. Shows the newest upload. */
export function UploadBanner() {
  const all = useUploads();
  const job = all[0];
  const others = all.length - 1;
  const insets = useSafeAreaInsets();
  const username = useMe().data?.username;

  const jobId = job?.id;
  const published = job?.phase === 'published';
  useEffect(() => {
    if (!published || !jobId) return;
    const t = setTimeout(() => uploads.dismiss(jobId), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [published, jobId]);

  if (!job) return null;
  const { title, detail } = describe(job);
  const inFlight =
    job.phase === 'compressing' ||
    job.phase === 'preparing' ||
    job.phase === 'uploading' ||
    (job.phase === 'processing' && !job.slow);

  const view = () => {
    if (!job.reelId) return;
    const reelId = job.reelId;
    uploads.dismiss(job.id);
    router.push({ pathname: '/feed', params: username ? { username, start: reelId } : { start: reelId } });
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(180)}
      style={[styles.wrap, { bottom: TabBarHeight + insets.bottom + Spacing.two }]}
      accessibilityLiveRegion="polite">
      <View style={styles.card}>
        <View style={styles.icon}>
          {inFlight ? (
            <PulseLoader size={24} dark />
          ) : job.phase === 'failed' ? (
            <AlertCircle size={24} color={Colors.hot} />
          ) : (
            <CheckCircle2 size={24} color={Colors.pulse} />
          )}
        </View>

        <View style={styles.text}>
          <AppText variant="bodyBold" color={Colors.iceWhite} numberOfLines={1}>
            {title}
            {others > 0 ? `  +${others}` : ''}
          </AppText>
          <AppText variant="caption" color={Colors.powderBlue} numberOfLines={2}>
            {detail}
          </AppText>
        </View>

        {job.phase === 'published' && (
          <Pressable accessibilityRole="button" onPress={view} style={styles.action}>
            <AppText variant="bodyBold" color={Colors.primaryDeep}>
              View
            </AppText>
          </Pressable>
        )}
        {job.phase === 'failed' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry upload"
            onPress={() => uploads.retry(job.id)}
            style={styles.action}>
            <RotateCcw size={16} color={Colors.primaryDeep} />
            <AppText variant="bodyBold" color={Colors.primaryDeep}>
              Retry
            </AppText>
          </Pressable>
        )}
        {!inFlight && (
          <Pressable
            accessibilityLabel={job.phase === 'failed' ? 'Discard upload' : 'Close'}
            hitSlop={10}
            onPress={() => uploads.dismiss(job.id)}>
            <X size={20} color={Colors.powderBlue} />
          </Pressable>
        )}

        {(job.phase === 'uploading' || job.phase === 'preparing' || job.phase === 'compressing') && (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${percent(job.progress)}%` }]} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const percent = (progress: number) => Math.round(Math.min(Math.max(progress, 0), 1) * 100);

function describe(job: UploadJob): { title: string; detail: string } {
  const caption = job.caption || 'Your Moment';
  switch (job.phase) {
    case 'compressing':
      return { title: `Preparing video · ${percent(job.progress)}%`, detail: 'Making it smaller so it posts faster.' };
    case 'preparing':
      return { title: 'Getting ready…', detail: caption };
    case 'uploading':
      return { title: `Posting · ${percent(job.progress)}%`, detail: 'Keep the app open until this finishes.' };
    case 'processing':
      return job.slow
        ? { title: 'Still processing', detail: "It'll go live on your profile when it's ready." }
        : {
            title: job.encoding ? `Processing · ${Math.round(job.encoding)}%` : 'Almost live',
            detail: 'Getting your video ready for every phone. You can keep scrolling.',
          };
    case 'published':
      return { title: 'Your Moment is live', detail: caption };
    case 'failed':
      return { title: "Didn't post", detail: job.error ?? 'Something went wrong.' };
  }
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.three, right: Spacing.three },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDeep,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  icon: { width: 28, alignItems: 'center' },
  text: { flex: 1, gap: 1 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.pulse,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(169, 192, 224, 0.25)',
  },
  fill: { height: '100%', backgroundColor: Colors.pulse },
});
