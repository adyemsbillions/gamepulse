import { Download } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Colors, Radius, Spacing, TabBarHeight } from '@/constants/theme';
import { useDownload } from '@/lib/downloads';

/** Progress card while a Moment is being downloaded and branded. Rendered once in the root layout. */
export function DownloadHost() {
  const d = useDownload();
  const insets = useSafeAreaInsets();
  const label =
    d?.stage === 'branding' ? 'Adding GamePulse branding' : d?.stage === 'saving' ? 'Saving to gallery' : 'Downloading';
  const pct = d ? Math.round(Math.min(Math.max(d.progress, 0), 1) * 100) : 0;

  return (
    <View pointerEvents="none" style={[styles.wrap, { bottom: TabBarHeight + insets.bottom + Spacing.two }]}>
      {d && (
        <Animated.View entering={FadeInDown.duration(200)} exiting={FadeOutDown.duration(160)} style={styles.card}>
          <Download size={20} color={Colors.pulse} />
          <View style={styles.text}>
            <AppText variant="bodyBold" color={Colors.iceWhite}>
              {label} · {pct}%
            </AppText>
            <AppText variant="caption" color={Colors.powderBlue} numberOfLines={1}>
              @{d.username}&apos;s Moment
            </AppText>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct}%` }]} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.three, right: Spacing.three },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDeep,
    overflow: 'hidden',
    elevation: 8,
  },
  text: { flex: 1, gap: 1 },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: 'rgba(169, 192, 224, 0.25)' },
  fill: { height: '100%', backgroundColor: Colors.pulse },
});
