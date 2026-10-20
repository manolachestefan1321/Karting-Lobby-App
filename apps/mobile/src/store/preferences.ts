import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Locale } from '@/lib/types';

export type ThemePreference = 'system' | 'dark' | 'light';

interface PreferencesState {
  /** null until the first launch has detected the device language. */
  locale: Locale | null;
  /** Dark is the default look of the app. */
  theme: ThemePreference;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: null,
      theme: 'dark',
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'kartapp-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ locale: s.locale, theme: s.theme }),
    },
  ),
);
