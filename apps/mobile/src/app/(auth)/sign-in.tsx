import { signInSchema } from '@kartup/domain';
import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View, type TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Wordmark } from '@/components/brand/Wordmark';
import { Button, Card, Screen, Text, TextField } from '@/components/ui';
import { api, ApiError } from '@/data';
import { errorKey } from '@/lib/errors';
import { zodResolver } from '@/lib/zodResolver';
import { spacing } from '@/theme/tokens';
import { TEST_EMAIL, TEST_PASSWORD } from '@/data/mock/seed';

// Demo login (an empty module in real-backend builds, where this hint is never shown).
const TEST = { email: TEST_EMAIL, password: TEST_PASSWORD };

export default function SignIn() {
  const { t } = useTranslation();
  const passwordRef = useRef<TextInput>(null);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState, getValues, setValue } = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      await api.auth.signInWithPassword(email, password);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_not_confirmed') {
        router.push({ pathname: '/verify-email', params: { email } });
        return;
      }
      setError(t(errorKey(err) as 'errors.generic'));
    }
  });

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Wordmark size={40} />
        <Text variant="title">{t('auth.logInTitle')}</Text>
      </View>
      {api.kind === 'mock' ? (
        <Card style={styles.hint}>
          <Text variant="small" tone="muted">
            {t('auth.previewHint', TEST)}
          </Text>
          <Button
            title={t('auth.useTestAccount')}
            variant="ghost"
            size="md"
            onPress={() => {
              setValue('email', TEST.email);
              setValue('password', TEST.password);
            }}
          />
        </Card>
      ) : null}
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label={t('auth.email')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            error={formState.errors.email?.message && t(formState.errors.email.message as 'validation.email')}
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            ref={passwordRef}
            label={t('auth.password')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
            error={formState.errors.password?.message && t(formState.errors.password.message as 'validation.required')}
          />
        )}
      />
      <Link href={{ pathname: '/forgot-password', params: { email: getValues('email') } }} accessibilityRole="link" style={styles.forgot}>
        <Text tone="accent">{t('auth.forgotPassword')}</Text>
      </Link>
      {error ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button title={t('auth.logIn')} onPress={() => void onSubmit()} loading={formState.isSubmitting} />
      <View style={styles.row}>
        <Text tone="muted">{t('auth.noAccount')}</Text>
        <Link href="/sign-up" replace accessibilityRole="link">
          <Text tone="accent" variant="bodyStrong">
            {t('auth.signUp')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.xxl, gap: spacing.lg },
  hint: { gap: spacing.xs, paddingVertical: spacing.md },
  forgot: { alignSelf: 'flex-end' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
});
