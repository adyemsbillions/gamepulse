import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { videoSource } from '@/lib/media';
import type { Reel } from '@/lib/types';

type Props = {
  reel: Reel;
  /** The Reel on screen and allowed to play (feed focused, not paused by the user). */
  playing: boolean;
  /** Whether this Reel is the one on screen — off-screen neighbours are preloaded but rewound. */
  active: boolean;
  muted: boolean;
  onReady?: () => void;
};

/**
 * One player per mounted Reel. The feed only mounts this for the active Reel and its direct
 * neighbours, so the next Reel is buffered while the rest of the feed stays as posters.
 */
export function ReelVideo({ reel, playing, active, muted, onReady }: Props) {
  const player = useVideoPlayer(videoSource(reel.playbackUrl), (p) => {
    p.loop = true;
    p.timeUpdateEventInterval = 0.25;
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

  const duration = player.duration || reel.durationSec;
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;

  return (
    <>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
        surfaceType="textureView"
      />
      {active && (
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>
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

const styles = StyleSheet.create({
  // Explicit size: a web <video> ignores `inset` alone.
  video: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(244, 254, 255, 0.25)',
  },
  fill: { height: '100%', backgroundColor: Colors.iceWhite },
});
