import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/barlow-condensed';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorState, Screen } from '@/components/ui';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { detectDeviceLocale, initI18n } from '@/i18n';
import { usePreferences } from '@/store/preferences';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
});

/** Waits for saved preferences, then sets the language (device language on first launch). */
function usePreferencesReady() {
  const [hydrated, setHydrated] = useState(usePreferences.persist.hasHydrated());
  useEffect(() => usePreferences.persist.onFinishHydration(() => setHydrated(true)), []);
  const locale = usePreferences((s) => s.locale);
  const setLocale = usePreferences((s) => s.setLocale);
  useEffect(() => {
    if (hydrated && !locale) setLocale(detectDeviceLocale());
  }, [hydrated, locale, setLocale]);
  // Synchronous on purpose: translations must be ready before the first screen renders.
  if (hydrated && locale) initI18n(locale);
  return hydrated && !!locale;
}

function RootNavigator() {
  const { initializing, session, profile, profileLoading, passwordRecovery, refreshProfile } = useAuth();
  const { scheme, colors } = useTheme();
  const signedIn = !!session;
  const onboarded = !!profile?.onboarded_at;
  const ready = !initializing && !profileLoading;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  // Signed in, but the profile could not be loaded (e.g. offline).
  if (signedIn && !profile) {
    return (
      <Screen scroll={false} edges={['top', 'bottom']}>
        <ErrorState onRetry={() => void refreshProfile()} />
      </Screen>
    );
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && passwordRecovery}>
          <Stack.Screen name="reset-password" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && !passwordRecovery && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && !passwordRecovery && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile/edit" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="profile/experience" options={{ headerShown: true, title: '', presentation: 'modal' }} />
          <Stack.Screen name="user/[id]" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="settings/index" options={{ headerShown: true, title: '' }} />
          <Stack.Screen name="settings/delete-account" options={{ headerShown: true, title: '' }} />
        </Stack.Protected>

        {/* Deep-link target for email confirmation, password reset and OAuth. Always reachable. */}
        <Stack.Screen name="auth/callback" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold });
  const prefsReady = usePreferencesReady();
  if (!fontsLoaded || !prefsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
