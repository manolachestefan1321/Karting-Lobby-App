import * as Linking from 'expo-linking';

/**
 * Deep link that Supabase redirects to after email confirmation, password reset
 * and OAuth (e.g. kartapp://auth/callback). Add it to Supabase → Auth → URL Configuration.
 */
export function authRedirectUrl(next?: 'reset-password'): string {
  return Linking.createURL('/auth/callback', next ? { queryParams: { next } } : undefined);
}
