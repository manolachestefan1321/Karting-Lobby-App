import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { brand } from '@config/brand';
import { Button, CheckeredStripe, Screen, Text } from '@/components/ui';
import { isAppleSignInAvailable, signInWithApple, signInWithGoogle, signInWithOAuthBrowser } from '@/features/auth/social';
import { errorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Provider = 'apple' | 'google' | 'facebook';

export default function Welcome() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    void isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const run = async (provider: Provider) => {
    setError(null);
    setBusy(provider);
    try {
      if (provider === 'apple') await signInWithApple();
      else if (provider === 'google') await signInWithGoogle();
      else await signInWithOAuthBrowser('facebook');
    } catch (err) {
      const key = errorKey(err);
      setError(t((key === 'errors.generic' ? 'errors.socialFailed' : key) as 'errors.generic'));
    } finally {
      setBusy(null);
    }
  };

  const tagline = i18n.language === 'ro' ? brand.tagline.ro : brand.tagline.en;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <CheckeredStripe />
        <Text variant="display" style={styles.brand}>
          {brand.name}
        </Text>
        <View style={[styles.speedLine, { backgroundColor: colors.accent }]} />
        <Text variant="title">{t('auth.welcomeTitle')}</Text>
        <Text tone="muted">{tagline}</Text>
      </View>

      <View style={styles.actions}>
        {appleAvailable ? (
          <Button
            title={t('auth.continueWithApple')}
            variant="secondary"
            icon={<Ionicons name="logo-apple" size={20} color={colors.text} />}
            loading={busy === 'apple'}
            disabled={!!busy}
            onPress={() => void run('apple')}
          />
        ) : null}
        <Button
          title={t('auth.continueWithGoogle')}
          variant="secondary"
          icon={<Ionicons name="logo-google" size={18} color={colors.text} />}
          loading={busy === 'google'}
          disabled={!!busy}
          onPress={() => void run('google')}
        />
        <Button
          title={t('auth.continueWithFacebook')}
          variant="secondary"
          icon={<Ionicons name="logo-facebook" size={20} color={colors.text} />}
          loading={busy === 'facebook'}
          disabled={!!busy}
          onPress={() => void run('facebook')}
        />
        {error ? (
          <Text tone="danger" align="center" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <Text variant="caption" tone="faint">
            {t('common.or').toUpperCase()}
          </Text>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>
        <Button title={t('auth.signUpWithEmail')} onPress={() => router.push('/sign-up')} disabled={!!busy} />
        <View style={styles.row}>
          <Text tone="muted">{t('auth.haveAccount')}</Text>
          <Link href="/sign-in" accessibilityRole="link">
            <Text tone="accent" variant="bodyStrong">
              {t('auth.logIn')}
            </Text>
          </Link>
        </View>
        {Platform.OS === 'web' ? null : <View style={{ height: spacing.sm }} />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  brand: { fontSize: 56, lineHeight: 58, fontStyle: 'italic' },
  speedLine: { height: 4, width: 96, transform: [{ skewX: '-30deg' }] },
  actions: { gap: spacing.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xs },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
});
