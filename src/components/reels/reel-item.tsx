import { Image } from 'expo-image';
import { router } from 'expo-router';
import { BadgeCheck, Play } from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { BURST_MS, CheerBursts, type Burst } from './cheer-burst';
import { ReelActions } from './reel-actions';
import { ReelCaption } from './reel-caption';
import { ReelVideo, SCRUBBER_HEIGHT } from './reel-video';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Colors, Spacing } from '@/constants/theme';
import { data } from '@/lib/api';
import { requireSignIn } from '@/lib/auth';
import { engagement, useCheered, useSupporting } from '@/lib/engagement-store';
import { imageSource } from '@/lib/media';
import { useMySupports } from '@/lib/queries';
import { useSessionUserId } from '@/lib/session';
import type { Reel } from '@/lib/types';

type Props = {
  reel: Reel;
  height: number;
  active: boolean;
  /** Mount a player (active Reel and its neighbours). */
  shouldLoad: boolean;
  paused: boolean;
  muted: boolean;
  onTogglePause: (reelId: string) => void;
  bottomInset?: number;
};

const viewed = new Set<string>();

export const ReelItem = memo(function ReelItem({
  reel,
  height,
  active,
  shouldLoad,
  paused,
  muted,
  onTogglePause,
  bottomInset = 0,
}: Props) {
  const creator = reel.creator;
  const myId = useSessionUserId();
  const serverSupports = useMySupports().data;
  const supporting = useSupporting(creator.id, serverSupports?.includes(creator.id) ?? false);
  const cheered = useCheered(reel);

  // Count a view once per reel per app session, after it has been on screen for a moment.
  useEffect(() => {
    if (!active || viewed.has(reel.id)) return;
    const t = setTimeout(() => {
      viewed.add(reel.id);
      data.recordView(reel.id).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [active, reel.id]);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  // Player unmounted (scrolled out of the preload window): show the poster again.
  if (!shouldLoad && ready) setReady(false);

  // Double-tap Cheers drop a pulse ball where you tapped. Several can be in flight at once.
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstSeq = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const cheer = (x: number, y: number) => {
    if (!requireSignIn()) return;
    engagement.cheer(reel, cheered, true);
    const id = ++burstSeq.current;
    setBursts((b) => [...b.slice(-3), { id, x, y, tilt: (Math.random() - 0.5) * 18 }]);
    const t = setTimeout(() => {
      timers.current.delete(t);
      setBursts((b) => b.filter((item) => item.id !== id));
    }, BURST_MS + 50);
    timers.current.add(t);
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd((e) => cheer(e.x, e.y));
  const singleTap = Gesture.Tap()
    .runOnJS(true)
    .onEnd(() => onTogglePause(reel.id));
  const taps = Gesture.Exclusive(doubleTap, singleTap);

  return (
    <View style={[styles.container, { height }]}>
      <Image
        source={imageSource(reel.thumbnailUrl)}
        style={[StyleSheet.absoluteFill, ready && styles.hidden]}
        contentFit="cover"
        transition={150}
      />
      {shouldLoad && (
        <ReelVideo
          reel={reel}
          active={active}
          playing={active && !paused}
          muted={muted}
          bottomInset={bottomInset}
          onReady={onReady}
        />
      )}

      <GestureDetector gesture={taps}>
        <View style={StyleSheet.absoluteFill} accessibilityLabel="Tap to pause, double tap to cheer" />
      </GestureDetector>

      <View pointerEvents="none" style={styles.center}>
        {active && paused && (
          <View style={styles.playBadge}>
            <Play size={36} color={Colors.iceWhite} fill={Colors.iceWhite} />
          </View>
        )}
      </View>

      <CheerBursts bursts={bursts} />

      <View pointerEvents="none" style={styles.scrim} />

      {/* Clear of the scrubber along the bottom edge, so dragging it never hits a button. */}
      <View style={[styles.overlay, { paddingBottom: bottomInset + SCRUBBER_HEIGHT }]} pointerEvents="box-none">
        <View style={styles.info} pointerEvents="box-none">
          <View style={styles.creatorRow}>
            <Pressable onPress={() => router.push(`/user/${creator.username}`)} style={styles.creatorName}>
              <AppText variant="bodyBold" color={Colors.iceWhite} style={styles.shadow}>
                @{creator.username}
              </AppText>
              {creator.verified && <BadgeCheck size={16} color={Colors.powderBlue} />}
            </Pressable>
            {myId !== undefined && creator.id !== myId && !supporting && (
              <Button
                label="Support"
                variant="ghost"
                labelColor={Colors.iceWhite}
                onPress={() => engagement.support(creator.id, supporting)}
                style={styles.supportBtn}
              />
            )}
          </View>
          <AppText variant="caption" color={Colors.powderBlue} style={styles.shadow}>
            {creator.countryFlag} {creator.country} · {creator.favoriteClub}
          </AppText>
          <ReelCaption caption={reel.caption} hashtags={reel.hashtags} />
        </View>
        <ReelActions reel={reel} creator={creator} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: Colors.primaryDeep, overflow: 'hidden' },
  hidden: { opacity: 0 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '38%',
    backgroundColor: 'rgba(8, 29, 77, 0.28)',
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  info: { flex: 1, gap: Spacing.one },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  creatorName: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  supportBtn: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.three,
    borderColor: Colors.iceWhite,
  },
  shadow: {
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
});
