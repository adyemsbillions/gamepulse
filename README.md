# GamePulse

Short football moments, felt live. A React Native + Expo app where fans post, cheer and share football clips.

## Stack

- Expo SDK 57, React Native 0.86, Expo Router (routes in `src/app/`)
- Reanimated 4 + Gesture Handler for the reel feed and cheer animations
- `react-native-svg` for the pulse-ball brand mark
- `expo-video` for playback
- Data: Supabase (Postgres + Auth + Storage) through TanStack Query. With no `.env.local`, the app runs on the bundled sample data in `src/lib/mock-data.ts`.

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
  tests/access_rules.test.sql              50+ access-rule checks; run locally only
  tests/api_smoke.test.ts                  the app's Supabase queries against a real API
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
