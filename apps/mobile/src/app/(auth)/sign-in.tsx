import { signInSchema } from '@kartapp/domain';
import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { errorKey } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { zodResolver } from '@/lib/zodResolver';
import { spacing } from '@/theme/tokens';

export default function SignIn() {
  const { t } = useTranslation();
  const passwordRef = useRef<TextInputInstance>(null);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState, getValues } = useForm({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      if (authError.code === 'email_not_confirmed') {
        router.push({ pathname: '/verify-email', params: { email } });
        return;
      }
      setError(t(errorKey(authError) as 'errors.generic'));
    }
  });

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text variant="title">{t('auth.logInTitle')}</Text>
      </View>
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
      <Link
        href={{ pathname: '/forgot-password', params: { email: getValues('email') } }}
        accessibilityRole="link"
        style={styles.forgot}
      >
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
  top: { paddingTop: spacing.xxxl, gap: spacing.sm },
  forgot: { alignSelf: 'flex-end' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
});
