import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CheckeredStripe, Text } from '@/components/ui';
import { api } from '@/data';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/tokens';
import { Wordmark } from './Wordmark';

/**
 * Website menu (web only): Home = the app itself (sign up / sign in, then the
 * app), and JOIN THE RACE = the launch-event sign-up page.
 */
/** HOME on the website = the app: sign up / sign in, or the app itself once signed in. */
/**
 * The real website's waitlist page (/ and /join) is a separate lightweight page (site/), not part
 * of the app: reach it with a normal page load there. Demo / development: the app's own page.
 */
const STANDALONE_SITE = api.kind === 'supabase';
function goToWaitlist(path: '/' | '/join') {
  if (STANDALONE_SITE) window.location.assign(path);
  else router.navigate(path);
}

export function useGoToApp() {
  const { user } = useAuth();
  return () => router.navigate(user ? '/' : '/welcome');
}

export function WebNav() {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const locale = usePreferences((s) => s.locale) ?? 'ro';
  const setLocale = usePreferences((s) => s.setLocale);
  const setTheme = usePreferences((s) => s.setTheme);
  const pathname = usePathname();
  const goToApp = useGoToApp();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const onJoin = pathname === '/join';

  return (
    <View style={{ backgroundColor: colors.background }}>
      <View style={styles.bar} accessibilityRole="header">
        <View style={styles.inner}>
          <Pressable onPress={() => (user ? router.navigate('/') : goToWaitlist('/'))} accessibilityRole="link" accessibilityLabel="KartUP">
            <Wordmark size={26} slogan={false} />
          </Pressable>
          <View style={styles.links}>
            {/* Visitors can't reach Settings on the website: language and light/dark live here. */}
            <Pressable
              onPress={() => setLocale(locale === 'ro' ? 'en' : 'ro')}
              accessibilityRole="button"
              accessibilityLabel={locale === 'ro' ? 'English' : 'Română'}
              style={styles.link}
            >
              <Text variant="label" tone="muted">
                {locale === 'ro' ? 'EN' : 'RO'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTheme(scheme === 'dark' ? 'light' : 'dark')}
              accessibilityRole="button"
              accessibilityLabel={scheme === 'dark' ? t('settings.themeLight') : t('settings.themeDark')}
              style={styles.link}
            >
              <Ionicons name={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={goToApp} accessibilityRole="link" style={styles.link}>
              <Text variant="label" tone={onJoin ? 'muted' : 'default'}>
                {t('web.home')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => goToWaitlist('/join')}
              accessibilityRole="link"
              style={[styles.cta, { backgroundColor: onJoin ? colors.text : colors.accent }]}
            >
              <Text style={[styles.ctaText, { color: onJoin ? colors.background : colors.onAccent }]}>{t('web.join')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <View style={styles.stripe} accessible={false}>
        <CheckeredStripe squares={Math.ceil(width / 6)} size={6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  stripe: { overflow: 'hidden' },
  ctaText: {
    fontFamily: fonts.wordmark,
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: 0.5,
  },
  inner: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  links: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  link: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  cta: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 4,
  },
});
