import { passwordSchema } from '@kartapp/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { errorKey } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme/tokens';

export default function ResetPassword() {
  const { t } = useTranslation();
  const { finishPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setFieldError(t(parsed.error.issues[0]!.message as 'validation.passwordLength'));
    setFieldError(undefined);
    setLoading(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (authError) return setError(t(errorKey(authError) as 'errors.generic'));
    finishPasswordRecovery();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text variant="title">{t('auth.newPasswordTitle')}</Text>
      </View>
      <TextField
        label={t('auth.newPassword')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        hint={t('auth.passwordHint')}
        error={fieldError}
      />
      {error ? <Text tone="danger">{error}</Text> : null}
      <Button title={t('auth.updatePassword')} onPress={() => void submit()} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({ top: { paddingTop: spacing.xxxl } });
