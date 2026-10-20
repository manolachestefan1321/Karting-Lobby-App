import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from 'expo-router';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { usePreferences } from '@/store/preferences';
import { darkColors, lightColors, type Colors } from './tokens';

interface ThemeValue {
  scheme: 'dark' | 'light';
  colors: Colors;
}

const ThemeContext = createContext<ThemeValue>({ scheme: 'dark', colors: darkColors });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = usePreferences((s) => s.theme);
  const system = useColorScheme();
  const scheme: 'dark' | 'light' = preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;
  const colors = scheme === 'dark' ? darkColors : lightColors;

  const navTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.accent,
      },
    };
  }, [scheme, colors]);

  const value = useMemo(() => ({ scheme, colors }), [scheme, colors]);
  return (
    <ThemeContext.Provider value={value}>
      <NavThemeProvider value={navTheme}>{children}</NavThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
