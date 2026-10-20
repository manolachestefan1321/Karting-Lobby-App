import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, LoadingState, Screen } from '@/components/ui';
import { api } from '@/data';

/**
 * Deep-link target after email confirmation, password-reset links and OAuth
 * (kartup://auth/callback?code=…). In the preview, the fake inbox opens it.
 */
export default function AuthCallback() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ code?: string; next?: string; error_description?: string }>();
  const [state, setState] = useState<'working' | 'confirmed' | 'failed'>('working');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    void api.auth.handleRedirect(params).then((result) => {
      if (result === 'signed_in' || result === 'password_recovery') router.replace('/');
      else setState(result === 'confirmed_elsewhere' ? 'confirmed' : 'failed');
    });
  }, [params]);

  if (state === 'working') return <LoadingState label={t('auth.signingIn')} />;
  return (
    <Screen scroll={false} edges={['top', 'bottom']}>
      <EmptyState
        icon={state === 'confirmed' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
        title={state === 'confirmed' ? t('auth.emailConfirmed') : t('auth.callbackFailed')}
      />
      <Button title={t('auth.backToLogin')} onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}
