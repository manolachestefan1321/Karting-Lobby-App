import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Wordmark } from '@/components/brand/Wordmark';
import { Button, CheckeredStripe, Chip, Screen, Text } from '@/components/ui';
import { api } from '@/data';
import { errorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Provider = 'apple' | 'google' | 'facebook';

/**
 * Real app: only the sign-in providers switched on in Supabase are shown, listed in
 * EXPO_PUBLIC_SOCIAL_LOGINS (e.g. "apple,google,facebook"). The demo shows all of them.
 */
const enabledProviders = new Set(
  api.kind === 'mock'
    ? ['apple', 'google', 'facebook']
    : (process.env.EXPO_PUBLIC_SOCIAL_LOGINS ?? '').split(',').map((p) => p.trim().toLowerCase()),
);
// App Store rule 4.8: an iPhone app that offers Google or Facebook sign-in must also offer Apple.
if (Platform.OS === 'ios' && (enabledProviders.has('google') || enabledProviders.has('facebook'))) enabledProviders.add('apple');

export default function Welcome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Apple sign-in is offered on iPhones (required by App Store rules). The preview shows it too.
  const [appleAvailable, setAppleAvailable] = useState(api.kind === 'mock');
  const showApple = appleAvailable && enabledProviders.has('apple');
  const showGoogle = enabledProviders.has('google');
  const showFacebook = enabledProviders.has('facebook');

  useEffect(() => {
    if (api.kind === 'mock' || Platform.OS !== 'ios' || !enabledProviders.has('apple')) return;
    void import('expo-apple-authentication').then((m) => m.isAvailableAsync()).then(setAppleAvailable);
  }, []);

  const run = async (provider: Provider) => {
    setError(null);
    setBusy(provider);
    try {
      await api.auth.signInWithProvider(provider);
    } catch (err) {
      const key = errorKey(err);
      setError(t((key === 'errors.generic' ? 'errors.socialFailed' : key) as 'errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <CheckeredStripe />
        <Wordmark size={68} />
        {api.kind === 'mock' ? (
          <View style={styles.demo}>
            <Chip label={t('auth.demoBadge')} tone="warning" icon="flask-outline" onPress={() => router.push('/dev')} accessibilityLabel={t('dev.open')} />
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {showApple ? (
          <Button
            title={t('auth.continueWithApple')}
            variant="secondary"
            icon={<Ionicons name="logo-apple" size={20} color={colors.text} />}
            loading={busy === 'apple'}
            disabled={!!busy}
            onPress={() => void run('apple')}
          />
        ) : null}
        {showGoogle ? (
          <Button
            title={t('auth.continueWithGoogle')}
            variant="secondary"
            icon={<Ionicons name="logo-google" size={18} color={colors.text} />}
            loading={busy === 'google'}
            disabled={!!busy}
            onPress={() => void run('google')}
          />
        ) : null}
        {showFacebook ? (
          <Button
            title={t('auth.continueWithFacebook')}
            variant="secondary"
            icon={<Ionicons name="logo-facebook" size={20} color={colors.text} />}
            loading={busy === 'facebook'}
            disabled={!!busy}
            onPress={() => void run('facebook')}
          />
        ) : null}
        {error ? (
          <Text tone="danger" align="center" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        {showApple || showGoogle || showFacebook ? (
          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Text variant="caption" tone="faint">
              {t('common.or').toUpperCase()}
            </Text>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
          </View>
        ) : null}
        <Button title={t('auth.signUpWithEmail')} onPress={() => router.push('/sign-up')} disabled={!!busy} />
        <View style={styles.row}>
          <Text tone="muted">{t('auth.haveAccount')}</Text>
          <Link href="/sign-in" accessibilityRole="link">
            <Text tone="accent" variant="bodyStrong">
              {t('auth.logIn')}
            </Text>
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingTop: spacing.xxl },
  demo: { flexDirection: 'row' },
  actions: { gap: spacing.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
});
