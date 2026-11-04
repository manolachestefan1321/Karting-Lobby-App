import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { api } from '@/data';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Entry point: send the user to the right place for their state.
 * Visitors of the real website who aren't signed in land on the waitlist page (Join the race);
 * HOME in the website menu takes them to the app (sign up / sign in).
 */
export default function Index() {
  const { user, profile, passwordRecovery } = useAuth();
  if (!user) return <Redirect href={Platform.OS === 'web' && api.kind === 'supabase' ? '/join' : '/welcome'} />;
  if (passwordRecovery) return <Redirect href="/reset-password" />;
  if (!profile?.onboardedAt) return <Redirect href="/onboarding" />;
  return <Redirect href="/sessions" />;
}
