import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type AuthUser, type Profile } from '@/data';
import { usePreferences } from '@/store/preferences';

interface AuthValue {
  /** True until the stored session has been read on app start. */
  initializing: boolean;
  user: AuthUser | null;
  profile: Profile | null;
  profileLoading: boolean;
  /** Set when the user opened a password-reset link; the app shows the new-password screen. */
  passwordRecovery: boolean;
  finishPasswordRecovery: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const profileQueryKey = (userId: string | undefined) => ['profile', userId] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    void api.auth.getUser().then((u) => {
      setUser(u);
      setInitializing(false);
    });
    return api.auth.onChange((next, event) => {
      setUser(next);
      if (event === 'password_recovery') setPasswordRecovery(true);
      if (event === 'signed_out') {
        setPasswordRecovery(false);
        queryClient.clear();
      } else {
        void queryClient.invalidateQueries();
      }
    });
  }, [queryClient]);

  const userId = user?.id;
  const profileQuery = useQuery({
    queryKey: profileQueryKey(userId),
    enabled: !!userId,
    queryFn: () => api.profiles.getMine(),
  });

  // Keep the profile's language in sync with the app language (used for notifications).
  const locale = usePreferences((s) => s.locale);
  useEffect(() => {
    if (profileQuery.data && locale && profileQuery.data.locale !== locale) void api.profiles.update({ locale });
  }, [profileQuery.data, locale]);

  const refreshProfile = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
  }, [queryClient, userId]);

  const value = useMemo<AuthValue>(
    () => ({
      initializing,
      user,
      profile: profileQuery.data ?? null,
      profileLoading: !!userId && profileQuery.isPending,
      passwordRecovery,
      finishPasswordRecovery: () => setPasswordRecovery(false),
      refreshProfile,
      signOut: () => api.auth.signOut(),
    }),
    [initializing, user, profileQuery.data, profileQuery.isPending, userId, passwordRecovery, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** The signed-in user's id (screens behind the auth guard only). */
export function useMyId(): string {
  const { user } = useAuth();
  return user?.id ?? '';
}
