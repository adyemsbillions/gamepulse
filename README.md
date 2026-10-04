# GamePulse

Short football moments, felt live. A React Native + Expo app where fans post, cheer and share football clips.

## Stack

- Expo SDK 57, React Native 0.86, Expo Router (routes in `src/app/`)
- Reanimated 4 + Gesture Handler for the reel feed and cheer animations
- `react-native-svg` for the pulse-ball brand mark
- `expo-video` for playback
- Video: Bunny Stream. The app uploads straight to Bunny over TUS; the `videos` Edge Function signs uploads and publishes reels when encoding finishes.
- Data: Supabase (Postgres + Auth + Edge Functions) through TanStack Query. With no `.env.local`, the app runs on the bundled sample data in `src/lib/mock-data.ts`.

## Run it

Create `.env.local` in the project root (copy `.env.example`) with the Supabase project URL and
publishable key. Leave it out to run on sample data.

```bash
npm install
npx expo start            # Expo Go / dev server
npx expo run:android      # development build (needed for the native splash and icons)
```

Before pushing:

```bash
npx tsc --noEmit
npx expo lint
```

## Project layout

```
src/
  app/                  screens (file-based routes)
    (tabs)/             Reels, Discover, Create, Alerts, Profile
    comments/[id].tsx   comments sheet
  components/
    brand/              pulse-ball mark, logo, animated splash
    reels/              feed, player, cheer button, double-tap burst
    ui/                 text, buttons, avatar, headers
  constants/theme.ts    colours, fonts, spacing tokens
  lib/
    data/               DataSource interface + mock and Supabase implementations
    queries.ts          TanStack Query hooks screens use (useFeed, useMe, useComments, …)
    session.ts          signed-in user id (Supabase auth, or the sample user)
    supabase.ts         Supabase client from EXPO_PUBLIC_* env vars
assets/
  images/               app icon, adaptive icon layers, splash, favicon
  expo.icon/            iOS 26 icon (Icon Composer)
  brand/                logo files for marketing and store listings
scripts/brand/          brand asset generator
```

## Database (Supabase)

```
supabase/
  migrations/
    20260928140000_core_schema.sql         tables, enums, profile-on-signup, hashtag + reply checks
    20260928140100_row_level_security.sql  column privileges + RLS policies for every table
    20260928140200_counters.sql            cheer/comment/replay/fan counters, record_view/record_share
    20260928200000_profile_from_google.sql name + photo from Google on sign-up
    20260928200100_notifications.sql       cheer/comment/replay/fan/mention notifications
    20260929100000_reel_failed_status.sql  'failed' reel status
    20260929100100_uploads.sql             daily upload count for the videos function
  functions/videos/                        Edge Function: signed uploads, status sync, delete, Bunny webhook
  manual/                                  SQL Editor fallbacks for when `db push` can't connect
  tests/access_rules.test.sql              50+ access-rule checks; run locally only
  tests/api_smoke.test.ts                  the app's Supabase queries against a real API
  tests/videos_function.test.ts            the videos function against a real API + fake Bunny
```

First time, after creating the Supabase project:

```bash
npx supabase init                 # creates supabase/config.toml, keeps the migrations
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push              # applies the migrations to the linked project
```

Rules of the schema:

- Clients never send their own user id: `user_id`, `supporter_id` and `reporter_id` default to the signed-in user.
- Counters (`*_count`), `profiles.role`, `profiles.verified` and `reels.status` are not writable from the app. Triggers keep the counters right; the video webhook (service role) moves reels through `uploading → processing → ready → published`.
- Supabase grants every new table to `anon` and `authenticated` by default. Any new migration that adds a table must enable RLS and revoke/grant columns the same way `20260928140100_row_level_security.sql` does.

## Sign-in (Google)

`src/lib/auth.ts` opens Google through Supabase in a secure in-app browser and returns to
`gamepulse://auth/callback`. One-time setup:

1. Google Cloud Console → OAuth client (type **Web application**), authorised redirect URI
   `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Sign In / Providers → **Google**: enable, paste the client ID and secret.
3. Supabase → Authentication → URL Configuration → Redirect URLs: add `gamepulse://**`.

New accounts get a placeholder username and are sent to `/onboarding` until they pick one.

## Video uploads (Bunny Stream)

Create tab → record or pick a clip (60 s max) → caption and hashtags → **Post Moment**. The app
asks the `videos` function for a signed upload, sends the file straight to Bunny over TUS
(resumable, retried), then polls until Bunny has encoded it and the reel is published. A banner
above the tab bar shows progress, and offers Retry if something fails. Owners can delete their
Moments from the ••• menu.

One-time setup:

1. bunny.net → **Stream** → **Add Video Library**. Pick the regions closest to your viewers.
2. In the library: **Encoding** → keep 360p, 480p and 720p on (enough for phones, cheaper).
3. **API** tab: copy the **Video Library ID**, **CDN hostname** (vz-….b-cdn.net), **API Key** and
   **Read-only API key**.
4. Secrets for the function (never put these in the app or `.env.local`):

   ```bash
   npx supabase secrets set BUNNY_LIBRARY_ID=<id> BUNNY_API_KEY=<api key> BUNNY_CDN_HOSTNAME=<vz-….b-cdn.net> BUNNY_READONLY_API_KEY=<read-only key>
   npx supabase functions deploy videos --no-verify-jwt --use-api
   ```

   `--no-verify-jwt` is needed because Bunny's webhook has no Supabase login; the function checks
   signed-in users itself.
5. In the library settings, set **Webhook URL** to `https://<project-ref>.supabase.co/functions/v1/videos/webhook`.
   Optional: the app also polls, so uploads still publish without it (just a little slower).

Limits (in `supabase/functions/videos/handler.ts`): 60 s, 300 MB, 20 uploads per user per day,
10 hashtags. Bunny's own reported length is checked after encoding, so a longer clip is rejected
even if a modified app skips the check.

If the library has **Block direct URL file access** on, Bunny refuses requests without a
`Referer`. Phones send none, so all Bunny media must load through `videoSource()` /
`imageSource()` in `src/lib/media.ts`, which add one.

## Over-the-air updates (EAS Update)

Changes to JavaScript/TypeScript (screens, logic, styles, images) reach installed apps without a
new APK. Builds check the `production` channel on launch and when they return to the foreground,
download quietly, then offer **Restart now**.

```bash
npx eas-cli@latest update --channel production --environment production --message "What changed"
```

It bundles on this PC (using `.env.local` for the Supabase keys) and uploads; no build quota used.

A new APK is still needed when **native** code changes: a new package with native code (like
expo-notifications was), `app.json` plugin/permission changes, or `google-services.json`. When that
happens, bump `version` in `app.json` (e.g. 1.0.0 → 1.1.0) before building. The runtime version
follows `version`, so old APKs never receive an update they can't run.

## Block, mute and rate limits

- **Block** (••• on a profile or a Moment): neither person sees the other's Moments or comments,
  cheers/comments/replays/saves on each other's Moments are refused, any Support between them ends,
  and no notifications pass between them. Unblock from the profile or Profile → ⚙ → Blocked accounts.
- **Mute**: hides that person's Moments from your Hot Now feed only. Private.
- **Rate limits** (`20261003100100_rate_limits.sql`): per account, comments 6/min and 100/hour,
  cheers 40/min and 600/hour, replays 20/min, supports 20/min and 200/hour, reports 5/min and
  30/hour. Over the limit the app shows a friendly message. Uploads are capped at 20/day by the
  videos function; sign-in attempts by Supabase Auth (Dashboard → Authentication → Rate Limits).

## Profile photos

Edit profile → tap the photo. It's cropped square, uploaded to the public `avatars` storage bucket
under `avatars/<user id>/`, and set as `profiles.avatar_url`; older photos are deleted. Each user
can only write inside their own folder, 5 MB max (migration `20261001100000_avatars.sql`).

## Push notifications

Every row in `notifications` (cheer, comment, new Fan, mention, replay) is also pushed to the
recipient's phones: a trigger hands the row's id to the `push` Edge Function, which sends it
through Expo's push service. A notification is pushed at most once and only within 10 minutes,
so the function needs no secret. Tapping a push opens the Moment's comments or the person's
profile. The app asks for permission once a signed-in user has finished profile setup.

One-time setup:

1. Apply migration `20261001100100_push.sql` (or `supabase/manual/apply_2026-10-01.sql`, which also
   sets the function URL for staging). For another project, point the trigger at its function:

   ```sql
   insert into private.settings values ('push_function_url', 'https://<project-ref>.supabase.co/functions/v1/push')
   on conflict (key) do update set value = excluded.value;
   ```

2. Deploy the function: `npx supabase functions deploy push --no-verify-jwt --use-api`
3. Firebase (Android): create a project at console.firebase.google.com → add an Android app with
   package `com.craviifoods.gamepulse` → download `google-services.json` into the project root.
   `app.config.js` links it automatically when the file is there; rebuild the app afterwards.
4. Firebase → Project settings → **Service accounts** → **Generate new private key**. Upload it to
   Expo: `npx eas-cli@latest credentials` → Android → production → **Google Service Account** →
   *Manage your Google Service Account Key for Push Notifications (FCM V1)* → upload the JSON.
   Keep that JSON file private; never commit it.
5. Optional: if you turn on *Enhanced push security* in the EAS dashboard, set
   `npx supabase secrets set EXPO_ACCESS_TOKEN=<token>`.

Tests: `npx tsx supabase/tests/push_function.test.ts` (no database needed).

## Brand

- Colours: Royal Blue `#0E2F76`, Ice White `#F4FEFF`, Powder Blue `#A9C0E0`, Pulse Volt `#C6FF3D` (cheers and anything "pulse").
- A Cheer is a pulse: the ball gets kicked, pulse rings fire. No hearts.
- Icons and splash images are generated from the same geometry as the in-app mark (`src/components/brand/geometry.ts`). After changing the mark:

  ```bash
  pip install cairosvg pillow shapely
  python scripts/brand/generate.py
  ```

- The native splash `imageWidth` in `app.json` (100) must equal `NATIVE_BALL_DP` in `src/components/brand/animated-splash.tsx`, so the ball doesn't jump when the animated splash takes over.

## Release

Built and shipped with EAS (`npx eas-cli@latest build`, `submit`, `update`). The `ios/` and `android/` folders are generated; configure native behaviour in `app.json`.
