import { emailSchema } from '@kartup/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, Text, TextField } from '@/components/ui';
import { errorKey } from '@/lib/errors';
import { api } from '@/data';
import { spacing } from '@/theme/tokens';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setFieldError(t('validation.email'));
    setFieldError(undefined);
    setError(null);
    setLoading(true);
    try {
      await api.auth.requestPasswordReset(parsed.data);
      setSentTo(parsed.data);
    } catch (err) {
      setError(t(errorKey(err) as 'errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text variant="title">{t('auth.resetTitle')}</Text>
        <Text tone="muted">{t('auth.resetSubtitle')}</Text>
      </View>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        error={fieldError}
      />
      {sentTo ? (
        <Card>
          <Text accessibilityLiveRegion="polite">{t('auth.resetSent', { email: sentTo })}</Text>
        </Card>
      ) : null}
      {error ? <Text tone="danger">{error}</Text> : null}
      <Button title={t('auth.sendResetLink')} onPress={() => void submit()} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({ top: { paddingTop: spacing.xxxl, gap: spacing.sm } });
