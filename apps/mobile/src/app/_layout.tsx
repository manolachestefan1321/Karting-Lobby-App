import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  BarlowCondensed_900Black_Italic,
  useFonts,
} from '@expo-google-fonts/barlow-condensed';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { brand } from '@config/brand';
import { AnimatedSplash } from '@/components/brand/AnimatedSplash';
import { removeInstantShell } from '@/features/web/shell';
import { DialogHost, ErrorState, Screen } from '@/components/ui';
import { api } from '@/data';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { BannerHost } from '@/features/notifications/BannerHost';
import { RankUpCelebration } from '@/components/brand/RankUpCelebration';
import { WebNav } from '@/components/brand/WebNav';
import { CookieBanner } from '@/features/web/CookieBanner';
import { SiteTracker } from '@/features/web/SiteTracker';
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

/** Visitors of the public website (real site, or the /join page): they get no app splash screen. */
const WEBSITE_ENTRY = Platform.OS === 'web' && (api.kind === 'supabase' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/join')));

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
  const pathname = usePathname();

  // The website's instant first view (public/index.html) is removed by the waitlist page itself;
  // anywhere else (e.g. a signed-in visitor sent from / to the app) it goes once the app is ready.
  useEffect(() => {
    if (ready && pathname !== '/' && pathname !== '/join') removeInstantShell();
  }, [ready, pathname]);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
    // Pages with their own <Head> (Join the race) set a Google title; the app keeps the brand one.
    if (Platform.OS === 'web' && !document.title) document.title = `${brand.name} — ${brand.slogan}`;
  }, [ready]);

  const header = { headerShown: true, title: '' };
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {Platform.OS === 'web' && ready ? <WebNav /> : null}
      {ready ? <SiteTracker /> : null}
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
            <Stack.Screen name="profile/history" options={header} />
            <Stack.Screen name="profile/self-report" options={{ ...header, presentation: 'modal' }} />
            <Stack.Screen name="admin/index" options={header} />
            <Stack.Screen name="admin/finance" options={header} />
            <Stack.Screen name="admin/analytics" options={header} />
            <Stack.Screen name="partner/index" options={header} />
            <Stack.Screen name="profile/experience" options={{ ...header, presentation: 'modal' }} />
            <Stack.Screen name="user/[id]" options={header} />
            <Stack.Screen name="settings/index" options={header} />
            <Stack.Screen name="settings/payments" options={header} />
            <Stack.Screen name="settings/delete-account" options={header} />
          </Stack.Protected>

          {/* Always reachable: email/OAuth deep links, the legal pages and Join the race (website). */}
          <Stack.Screen name="auth/callback" />
          <Stack.Screen name="join" />
          <Stack.Screen name="legal/[doc]" options={header} />
          <Stack.Screen name="dev" options={header} />
        </Stack>
      ) : null}
      <BannerHost enabled={signedIn} />
      <RankUpCelebration enabled={signedIn} />
      <DialogHost />
      {/* Real website only: the demo stores no statistics, so it needs no consent. */}
      {Platform.OS === 'web' && ready && api.kind === 'supabase' ? <CookieBanner /> : null}
      {api.kind === 'mock' ? <DebugBridge /> : null}
      {/* The website (waitlist) opens straight on its first view: no intro screen there. */}
      {WEBSITE_ENTRY ? null : <AnimatedSplash ready={ready} />}
    </View>
  );
}

const NATIVE_FONTS = { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold, BarlowCondensed_900Black_Italic };
/**
 * Website: the same fonts from fixed addresses in public/fonts (written by scripts/brand-sync.ts).
 * index.html preloads them while the app's code downloads, so they are already there when needed.
 */
const WEB_FONTS: Record<keyof typeof NATIVE_FONTS, string> = {
  BarlowCondensed_600SemiBold: '/fonts/BarlowCondensed_600SemiBold.ttf',
  BarlowCondensed_700Bold: '/fonts/BarlowCondensed_700Bold.ttf',
  BarlowCondensed_800ExtraBold: '/fonts/BarlowCondensed_800ExtraBold.ttf',
  BarlowCondensed_900Black_Italic: '/fonts/BarlowCondensed_900Black_Italic.ttf',
};
const FONTS = Platform.OS === 'web' ? WEB_FONTS : NATIVE_FONTS;

/**
 * Web: useFonts can report "loaded" a moment before the browser can actually draw the font, so
 * the first paint used a fallback font and the text jumped when Barlow arrived (worst on slow
 * phone connections). Wait until the browser confirms each font is usable. The website's
 * instant first view stays on screen meanwhile, so nobody looks at a blank page.
 */
function useWebFontsUsable(loaded: boolean): boolean {
  const [usable, setUsable] = useState(Platform.OS !== 'web');
  useEffect(() => {
    if (!loaded || usable) return;
    if (!document.fonts) return setUsable(true);
    const names = Object.keys(FONTS);
    const families = names.map((f) => `16px "${f}"`);
    // check() is also true when the font isn't on the page yet, so first wait for it to be there.
    const registered = () => names.every((f) => [...document.fonts].some((face) => face.family.replace(/["']/g, '') === f));
    const started = Date.now();
    // expo-font adds the fonts to the page a moment after useFonts resolves, and the browser
    // only downloads a font once asked: keep asking until every one can actually be drawn.
    const id = setInterval(() => {
      const pending = registered() ? families.filter((f) => !document.fonts.check(f)) : families;
      pending.forEach((f) => void document.fonts.load(f).catch(() => undefined));
      if (!pending.length || Date.now() - started > 3000) {
        clearInterval(id);
        setUsable(true);
      }
    }, 40);
    return () => clearInterval(id);
  }, [loaded, usable]);
  return loaded && usable;
}

export default function RootLayout() {
  const [fontsReady] = useFonts(FONTS);
  const fontsLoaded = useWebFontsUsable(fontsReady);
  const prefsReady = usePreferencesReady();
  useEffect(() => {
    if (SHOW_PREVIEW_HOST) removeInstantShell(); // the demo's preview page is not the website
  }, []);
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
