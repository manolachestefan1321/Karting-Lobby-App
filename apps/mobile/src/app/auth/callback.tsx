import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, LoadingState, Screen } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';

/**
 * Supabase redirects here (kartapp://auth/callback?code=…) after:
 *  - email confirmation,
 *  - password reset links (&next=reset-password),
 *  - Facebook / web OAuth.
 */
export default function AuthCallback() {
  const { t } = useTranslation();
  const { startPasswordRecovery } = useAuth();
  const params = useLocalSearchParams<{ code?: string; next?: string; error_description?: string }>();
  const [state, setState] = useState<'working' | 'confirmed' | 'failed'>('working');
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    (async () => {
      if (params.error_description || !params.code) return setState('failed');
      const { error } = await supabase.auth.exchangeCodeForSession(params.code);
      if (error) {
        // The link was opened on another device/browser: the email IS confirmed,
        // but this app has no matching PKCE verifier. Ask the user to log in.
        return setState(params.next === 'reset-password' ? 'failed' : 'confirmed');
      }
      if (params.next === 'reset-password') startPasswordRecovery();
      router.replace('/');
    })();
  }, [params, startPasswordRecovery]);

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
