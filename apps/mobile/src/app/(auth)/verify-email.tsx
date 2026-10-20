import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components/ui';
import { authRedirectUrl } from '@/features/auth/redirect';
import { errorKey } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function VerifyEmail() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl() } });
    setLoading(false);
    setStatus(error ? t(errorKey(error) as 'errors.generic') : t('auth.emailResent'));
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.center}>
        <View style={[styles.icon, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="mail-unread-outline" size={40} color={colors.accent} />
        </View>
        <Text variant="title" align="center">
          {t('auth.verifyTitle')}
        </Text>
        <Text tone="muted" align="center">
          {t('auth.verifyBody', { email })}
        </Text>
        {status ? (
          <Text align="center" accessibilityLiveRegion="polite">
            {status}
          </Text>
        ) : null}
      </View>
      <Button title={t('auth.resendEmail')} variant="secondary" onPress={() => void resend()} loading={loading} />
      <Button title={t('auth.backToLogin')} variant="ghost" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  icon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
});
