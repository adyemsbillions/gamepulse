/**
 * statusFor() maps Bunny's Get Video status (VideoModelStatus) to reel status. No stack needed:
 *
 *   npx tsx supabase/tests/videos_status.test.ts
 *
 * Guards the bug where webhook status numbers were used for Get Video, which left failed uploads
 * stuck on "processing" and marked playable JIT videos as failed.
 */
import assert from 'node:assert/strict';

import { statusFor } from '../functions/videos/handler';

const cases: [string, { status: number; availableResolutions?: string | null }, string | null][] = [
  ['0 Created: file not here yet', { status: 0 }, null],
  ['1 Uploaded', { status: 1 }, 'processing'],
  ['2 Processing', { status: 2 }, 'processing'],
  ['3 Transcoding, nothing playable yet', { status: 3, availableResolutions: '' }, 'processing'],
  ['3 Transcoding, first resolution ready', { status: 3, availableResolutions: '360p' }, 'published'],
  ['4 Finished', { status: 4, availableResolutions: '360p,720p' }, 'published'],
  ['5 Error', { status: 5 }, 'failed'],
  ['6 UploadFailed (was ignored before)', { status: 6 }, 'failed'],
  ['7 JitSegmenting', { status: 7 }, 'processing'],
  ['8 JitPlaylistsCreated (was "failed" before)', { status: 8 }, 'published'],
];

for (const [name, video, expected] of cases) {
  assert.equal(statusFor(video), expected, name);
  console.log(`ok - ${name} → ${expected}`);
}
console.log(`\n${cases.length} status mappings correct`);
