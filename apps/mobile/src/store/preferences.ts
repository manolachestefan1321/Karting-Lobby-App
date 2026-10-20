import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Locale } from '@/data/types';

export type ThemePreference = 'system' | 'dark' | 'light';

interface PreferencesState {
  /** null until the first launch has detected the device language. */
  locale: Locale | null;
  /** Dark is the default look of the app. */
  theme: ThemePreference;
  /** City shown on the Sessions tab (defaults to the profile's home city). */
  cityId: string | null;
  setCityId: (id: string) => void;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      locale: null,
      theme: 'dark',
      cityId: null,
      setCityId: (cityId) => set({ cityId }),
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'kartup-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ locale: s.locale, theme: s.theme, cityId: s.cityId }),
    },
  ),
);
