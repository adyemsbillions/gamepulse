import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { AppText } from '@/components/ui/app-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { playbackUrl, videoBufferOptions, videoSource } from '@/lib/media';
import type { Reel } from '@/lib/types';

type Props = {
  reel: Reel;
  /** The Reel on screen and allowed to play (feed focused, not paused by the user). */
  playing: boolean;
  /** Whether this Reel is the one on screen — off-screen neighbours are preloaded but rewound. */
  active: boolean;
  muted: boolean;
  /** Space under the video taken by system UI; the scrubber sits just above it. */
  bottomInset?: number;
  onReady?: () => void;
};

/** Height of the touch area along the bottom edge that scrubs the video. */
export const SCRUBBER_HEIGHT = 28;

/** How long to keep showing where you let go, while the player catches up with the seek. */
const SETTLE_MS = 600;

/**
 * One player per mounted Reel. The feed only mounts this for the active Reel and its direct
 * neighbours, so the next Reel is buffered while the rest of the feed stays as posters.
 * The poster shows until the stream (best quality up to 720p, see media.ts) has been chosen.
 */
export function ReelVideo(props: Props) {
  const source = props.reel.playbackUrl;
  const [resolved, setResolved] = useState<{ from: string; url: string } | null>(null);

  useEffect(() => {
    let live = true;
    playbackUrl(source).then((url) => live && setResolved({ from: source, url }));
    return () => {
      live = false;
    };
  }, [source]);

  if (!resolved || resolved.from !== source) return null;
  return <Player {...props} url={resolved.url} />;
}

function Player({ reel, playing, active, muted, bottomInset = 0, onReady, url }: Props & { url: string }) {
  const player = useVideoPlayer(videoSource(url), (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.25;
    p.bufferOptions = videoBufferOptions;
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { currentTime } = useEvent(player, 'timeUpdate', {
    currentTime: 0,
    bufferedPosition: 0,
    currentLiveTimestamp: null,
    currentOffsetFromLive: null,
  });

  useEffect(() => setMuted(player, muted), [player, muted]);

  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);

  useEffect(() => {
    if (!active) rewind(player);
  }, [player, active]);

  useEffect(() => {
    if (status === 'readyToPlay') onReady?.();
  }, [status, onReady]);

  // ---- scrubbing: drag along the bar (or tap it) to jump back or forward
  const [trackWidth, setTrackWidth] = useState(0);
  /** 0–1 under the finger while dragging. */
  const [dragging, setDragging] = useState<number | null>(null);
  /** 0–1 just released, shown until the player has caught up. */
  const [settling, setSettling] = useState<number | null>(null);
  useEffect(() => {
    if (settling === null) return;
    const t = setTimeout(() => setSettling(null), SETTLE_MS);
    return () => clearTimeout(t);
  }, [settling]);

  const duration = player.duration || reel.durationSec;
  const fractionAt = (x: number) => (trackWidth > 0 ? Math.min(Math.max(x / trackWidth, 0), 1) : 0);

  const commit = (fraction: number) => {
    if (duration <= 0) return;
    seek(player, fraction * duration);
    setSettling(fraction);
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    // Horizontal drags scrub; vertical ones fail fast so the feed still swipes to the next Reel.
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onStart((e) => {
      player.pause();
      setDragging(fractionAt(e.x));
    })
    .onUpdate((e) => setDragging(fractionAt(e.x)))
    .onEnd((e) => commit(fractionAt(e.x)))
    .onFinalize(() => {
      setDragging(null);
      if (playing) player.play();
    });
  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => commit(fractionAt(e.x)));
  const scrub = Gesture.Race(pan, tap);

  const shown = dragging ?? settling ?? (duration > 0 ? Math.min(currentTime / duration, 1) : 0);
  const scrubbing = dragging !== null;

  return (
    <>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
      />
      {active && duration > 0 && (
        <>
          {scrubbing && (
            <View pointerEvents="none" style={[styles.timeBubble, { bottom: bottomInset + SCRUBBER_HEIGHT + Spacing.two }]}>
              <AppText style={styles.time} color={Colors.iceWhite}>
                {formatTime(shown * duration)} / {formatTime(duration)}
              </AppText>
            </View>
          )}
          <GestureDetector gesture={scrub}>
            <View
              accessibilityRole="adjustable"
              accessibilityLabel="Video progress"
              accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(shown * duration) }}
              onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
              style={[styles.scrubber, { bottom: bottomInset }]}>
              <View style={[styles.track, scrubbing && styles.trackActive]}>
                <View style={[styles.fill, { width: `${shown * 100}%` }]} />
              </View>
              {scrubbing && <View style={[styles.thumb, { left: shown * trackWidth - THUMB / 2 }]} />}
            </View>
          </GestureDetector>
        </>
      )}
    </>
  );
}

// The player is an imperative native object; mutate it outside render scope.
function setMuted(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}

function rewind(player: VideoPlayer) {
  player.currentTime = 0;
}

function seek(player: VideoPlayer, seconds: number) {
  player.currentTime = seconds;
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const THUMB = 14;

const styles = StyleSheet.create({
  // Explicit size: a web <video> ignores `inset` alone.
  video: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  // Above the tap-to-pause layer (a later sibling), so touches on the bar reach it.
  scrubber: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: SCRUBBER_HEIGHT,
    justifyContent: 'flex-end',
    zIndex: 2,
    elevation: 2,
  },
  track: {
    height: 3,
    backgroundColor: 'rgba(244, 254, 255, 0.25)',
  },
  trackActive: { height: 6 },
  fill: { height: '100%', backgroundColor: Colors.iceWhite },
  thumb: {
    position: 'absolute',
    bottom: 3 - THUMB / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: Colors.iceWhite,
  },
  timeBubble: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    backgroundColor: Colors.scrim,
    zIndex: 2,
    elevation: 2,
  },
  time: { fontFamily: Fonts.semibold, fontSize: 18, fontVariant: ['tabular-nums'] },
});
