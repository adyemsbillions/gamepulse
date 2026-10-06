import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { AuthGate } from '@/components/auth-gate';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplash } from '@/components/brand/animated-splash';
import { ActionSheetHost } from '@/components/ui/action-sheet';
import { ToastHost } from '@/components/ui/toast';
import { UpdatePrompt } from '@/components/update-prompt';
import { Colors } from '@/constants/theme';
import { queryClient } from '@/lib/queries';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 180 });

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  const [splashDone, setSplashDone] = useState(false);

  if (!loaded && !error) return null;

  return (
    <QueryClientProvider client={queryClient}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={splashDone ? 'auto' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="feed" options={{ contentStyle: { backgroundColor: Colors.primaryDeep } }} />
        <Stack.Screen
          name="comments/[id]"
          options={{
            presentation: 'formSheet',
            // One height only: with several, the screen is laid out at the tallest one, which
            // pushed the comment box below the bottom edge until the sheet was dragged up.
            sheetAllowedDetents: [0.85],
            sheetGrabberVisible: true,
            sheetCornerRadius: 22,
          }}
        />
        <Stack.Screen name="report" options={{ presentation: 'modal' }} />
        <Stack.Screen name="compose" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="sign-in" options={{ presentation: 'fullScreenModal', animation: 'fade_from_bottom' }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="auth/callback" options={{ contentStyle: { backgroundColor: Colors.primaryDeep } }} />
      </Stack>
      <AuthGate />
      <ActionSheetHost />
      <ToastHost />
      <UpdatePrompt />
      {/* Takes over from the native splash (it hides it on first layout), then fades out. */}
      {!splashDone && <AnimatedSplash onDone={() => setSplashDone(true)} />}
    </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
