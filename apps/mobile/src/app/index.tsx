import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';

/** Entry point: send the user to the right place for their state. */
export default function Index() {
  const { user, profile, passwordRecovery } = useAuth();
  if (!user) return <Redirect href="/welcome" />;
  if (passwordRecovery) return <Redirect href="/reset-password" />;
  if (!profile?.onboardedAt) return <Redirect href="/onboarding" />;
  return <Redirect href="/sessions" />;
}
