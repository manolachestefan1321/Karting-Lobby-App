import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { usePreferences } from '@/store/preferences';
import { signOutEverywhere } from './social';

interface AuthValue {
  /** True until the stored session has been read on app start. */
  initializing: boolean;
  session: Session | null;
  profile: Profile | null;
  profileLoading: boolean;
  /** Set when the user opened a password-reset link; the app shows the new-password screen. */
  passwordRecovery: boolean;
  startPasswordRecovery: () => void;
  finishPasswordRecovery: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const profileQueryKey = (userId: string | undefined) => ['profile', userId] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
        queryClient.clear();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id;
  const profileQuery = useQuery({
    queryKey: profileQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single();
      if (error) throw error;
      return data as Profile;
    },
  });

  // Keep the profile's language in sync with the app language (used for push notifications later).
  const locale = usePreferences((s) => s.locale);
  useEffect(() => {
    if (profileQuery.data && locale && profileQuery.data.locale !== locale) {
      void supabase.from('profiles').update({ locale }).eq('id', profileQuery.data.id);
    }
  }, [profileQuery.data, locale]);

  const refreshProfile = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
  }, [queryClient, userId]);

  const value = useMemo<AuthValue>(
    () => ({
      initializing,
      session,
      profile: profileQuery.data ?? null,
      profileLoading: !!userId && profileQuery.isPending,
      passwordRecovery,
      startPasswordRecovery: () => setPasswordRecovery(true),
      finishPasswordRecovery: () => setPasswordRecovery(false),
      refreshProfile,
      signOut: signOutEverywhere,
    }),
    [initializing, session, profileQuery.data, profileQuery.isPending, userId, passwordRecovery, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
