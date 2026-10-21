import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_900Black_Italic,
  useFonts,
} from '@expo-google-fonts/barlow-condensed';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { brand } from '@config/brand';
import { AnimatedSplash } from '@/components/brand/AnimatedSplash';
import { DialogHost, ErrorState, Screen } from '@/components/ui';
import { api } from '@/data';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { BannerHost } from '@/features/notifications/BannerHost';
import { detectDeviceLocale, i18n, initI18n } from '@/i18n';
import { DebugBridge } from '@/preview/DebugBridge';
import { PreviewHost } from '@/preview/PreviewHost';
import { isPreviewHost } from '@/preview/protocol';
import { usePreferences } from '@/store/preferences';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

/** The outer web-preview page (phone frame + debug panel) instead of the app. */
const SHOW_PREVIEW_HOST = Platform.OS === 'web' && api.kind === 'mock' && isPreviewHost();

/** Waits for saved preferences, then sets the language (device language on first launch). */
function usePreferencesReady() {
  const [hydrated, setHydrated] = useState(usePreferences.persist.hasHydrated());
  useEffect(() => usePreferences.persist.onFinishHydration(() => setHydrated(true)), []);
  const locale = usePreferences((s) => s.locale);
  const setLocale = usePreferences((s) => s.setLocale);
  useEffect(() => {
    if (hydrated && !locale) setLocale(detectDeviceLocale());
  }, [hydrated, locale, setLocale]);
  // First init is synchronous: translations must be ready before the first screen renders.
  if (hydrated && locale && !i18n.isInitialized) initI18n(locale);
  // Later language switches (Settings) happen after render, never during it.
  useEffect(() => {
    if (locale && i18n.isInitialized && i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [locale]);
  return hydrated && !!locale;
}

function RootNavigator() {
  const { initializing, user, profile, profileLoading, passwordRecovery, refreshProfile } = useAuth();
  const { scheme, colors } = useTheme();
  const signedIn = !!user;
  const onboarded = !!profile?.onboardedAt;
  const ready = !initializing && !profileLoading;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
    if (Platform.OS === 'web') document.title = `${brand.name} — ${brand.slogan}`;
  }, [ready]);

  const header = { headerShown: true, title: '' };
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {ready && signedIn && !profile ? (
        <Screen scroll={false} edges={['top', 'bottom']}>
          <ErrorState onRetry={() => void refreshProfile()} />
        </Screen>
      ) : ready ? (
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
          <Stack.Screen name="index" />
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
            <Stack.Screen name="session/[id]/index" options={header} />
            <Stack.Screen name="session/[id]/chat" options={header} />
            <Stack.Screen name="session/[id]/results" options={header} />
            <Stack.Screen name="profile/edit" options={header} />
            <Stack.Screen name="profile/points" options={header} />
            <Stack.Screen name="profile/experience" options={{ ...header, presentation: 'modal' }} />
            <Stack.Screen name="user/[id]" options={header} />
            <Stack.Screen name="settings/index" options={header} />
            <Stack.Screen name="settings/payments" options={header} />
            <Stack.Screen name="settings/delete-account" options={header} />
          </Stack.Protected>

          {/* Always reachable: email/OAuth deep links and the legal pages. */}
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="legal/[doc]" options={header} />
          <Stack.Screen name="dev" options={header} />
        </Stack>
      ) : null}
      <BannerHost enabled={signedIn} />
      <DialogHost />
      {api.kind === 'mock' ? <DebugBridge /> : null}
      <AnimatedSplash ready={ready} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, BarlowCondensed_900Black_Italic });
  const prefsReady = usePreferencesReady();
  if (SHOW_PREVIEW_HOST) return <PreviewHost />;
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
