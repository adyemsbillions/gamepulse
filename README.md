# GamePulse

Short football moments, felt live. A React Native + Expo app where fans post, cheer and share football clips.

## Stack

- Expo SDK 57, React Native 0.86, Expo Router (routes in `src/app/`)
- Reanimated 4 + Gesture Handler for the reel feed and cheer animations
- `react-native-svg` for the pulse-ball brand mark
- `expo-video` for playback
- Data: mock data in `src/lib/mock-data.ts` for now. Supabase is next (see the launch board).

## Run it

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
  lib/                  api, engagement store, types, mock data
assets/
  images/               app icon, adaptive icon layers, splash, favicon
  expo.icon/            iOS 26 icon (Icon Composer)
  brand/                logo files for marketing and store listings
scripts/brand/          brand asset generator
```

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
