import { signUpSchema } from '@kartapp/domain';
import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View, type TextInputInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Screen, Text, TextField } from '@/components/ui';
import { authRedirectUrl } from '@/features/auth/redirect';
import { TermsText } from '@/features/profile/ProfileForm';
import { errorKey } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { zodResolver } from '@/lib/zodResolver';
import { usePreferences } from '@/store/preferences';
import { spacing } from '@/theme/tokens';

export default function SignUp() {
  const { t } = useTranslation();
  const locale = usePreferences((s) => s.locale);
  const passwordRef = useRef<TextInputInstance>(null);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', acceptTerms: false as unknown as true },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError(null);
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authRedirectUrl(),
        data: { terms_accepted: true, locale },
      },
    });
    if (authError) return setError(t(errorKey(authError) as 'errors.generic'));
    // With email confirmation on, there is no session until the link is opened.
    if (!data.session) router.replace({ pathname: '/verify-email', params: { email } });
  });

  const msg = (m?: string) => (m ? t(m as 'validation.required') : undefined);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text variant="title">{t('auth.signUpTitle')}</Text>
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
            error={msg(formState.errors.email?.message)}
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
            autoComplete="new-password"
            textContentType="newPassword"
            hint={t('auth.passwordHint')}
            error={msg(formState.errors.password?.message)}
          />
        )}
      />
      <Controller
        control={control}
        name="acceptTerms"
        render={({ field }) => (
          <View style={styles.gapXs}>
            <Checkbox checked={!!field.value} onChange={field.onChange} accessibilityLabel={t('validation.acceptTerms')}>
              <TermsText />
            </Checkbox>
            {formState.errors.acceptTerms ? (
              <Text variant="small" tone="danger">
                {t('validation.acceptTerms')}
              </Text>
            ) : null}
          </View>
        )}
      />
      {error ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button title={t('auth.signUp')} onPress={() => void onSubmit()} loading={formState.isSubmitting} />
      <View style={styles.row}>
        <Text tone="muted">{t('auth.haveAccount')}</Text>
        <Link href="/sign-in" replace accessibilityRole="link">
          <Text tone="accent" variant="bodyStrong">
            {t('auth.logIn')}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.xxxl },
  gapXs: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
});
