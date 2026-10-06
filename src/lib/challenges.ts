/**
 * Weekly challenges and duets: starting a Moment that joins a challenge or responds to another.
 * Both set a preset for the compose screen, then open the Create tab to pick or record a clip.
 */
import { router } from 'expo-router';

import { requireSignIn } from './auth';
import type { Challenge, Reel } from './types';
import { draftVideo } from './uploads';

export function joinChallenge(challenge: Pick<Challenge, 'tag'>) {
  if (!requireSignIn()) return;
  draftVideo.setPreset({ caption: `#${challenge.tag} `, label: `Joining #${challenge.tag}` });
  router.navigate('/create');
}

export function respondTo(reel: Reel) {
  if (!requireSignIn()) return;
  draftVideo.setPreset({
    replyTo: { reelId: reel.id, username: reel.creator.username },
    label: `Responding to @${reel.creator.username}`,
  });
  router.navigate('/create');
}

/** Still running (entries count), finished (winner known or being worked out), or not started. */
export function challengeState(c: Pick<Challenge, 'startsAt' | 'endsAt' | 'finished'>, now = Date.now()) {
  if (now < Date.parse(c.startsAt)) return 'upcoming' as const;
  if (now < Date.parse(c.endsAt)) return 'live' as const;
  return c.finished ? ('crowned' as const) : ('counting' as const);
}
