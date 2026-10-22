import { brand } from '@config/brand';

/**
 * Design tokens — 60 / 30 / 10 color rule:
 *  - 60% main color   #F5E6CC (cream): screen backgrounds and cards;
 *  - 30% secondary    #181818 (near-black): text, tab bar, secondary buttons, controls;
 *  - 10% accent       #E00000 (red, from config/brand.ts): primary buttons, selections, highlights.
 * The dark theme uses the same three colors the other way round.
 * Body text contrast is ≥ 4.5:1 (WCAG AA); red text uses a slightly deeper red for that.
 */
const MAIN = '#F5E6CC';
const SECONDARY = '#181818';

const shared: Record<'accent' | 'accentPressed' | 'onAccent' | 'success' | 'warning' | 'danger', string> = {
  accent: brand.colors.accent,
  accentPressed: brand.colors.accentPressed,
  onAccent: '#FFFFFF',
  success: '#22A750',
  warning: '#E5A000',
  danger: '#FF453A',
};

export const lightColors: Record<string, string> & typeof shared & {
  background: string; surface: string; surfaceAlt: string; border: string; text: string;
  textMuted: string; textFaint: string; overlay: string; accentText: string;
  /** The 30% color: tab bar, secondary buttons, segmented controls. */
  secondary: string; onSecondary: string; onSecondaryMuted: string;
} = {
  ...shared,
  background: MAIN,
  surface: '#FBF3E4',
  surfaceAlt: '#EEDCBB',
  border: '#D6C19C',
  text: SECONDARY,
  textMuted: '#4A4236',
  textFaint: '#6B6050',
  overlay: 'rgba(24,24,24,0.45)',
  accentText: '#B80000',
  success: '#1B7A35',
  warning: '#8A5A00',
  danger: '#B80000',
  secondary: SECONDARY,
  onSecondary: MAIN,
  onSecondaryMuted: '#B9AD98',
};

export const darkColors: typeof lightColors = {
  ...shared,
  background: SECONDARY,
  // Cards sit a step lighter than the background so they stay visible.
  surface: '#222222',
  surfaceAlt: '#2C2C2C',
  border: '#3A3A3A',
  text: MAIN,
  textMuted: '#C9BCA5',
  textFaint: '#9A8F7D',
  overlay: 'rgba(0,0,0,0.6)',
  accentText: '#FF4D47', // accent tuned for text on dark surfaces (AA contrast)
  secondary: MAIN,
  onSecondary: SECONDARY,
  onSecondaryMuted: '#4A4236',
};

export type Colors = typeof lightColors;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const fonts = {
  display: 'BarlowCondensed_800ExtraBold',
  heading: 'BarlowCondensed_700Bold',
  headingMedium: 'BarlowCondensed_600SemiBold',
  wordmark: 'BarlowCondensed_900Black_Italic',
} as const;

export const typography = {
  display: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 32, letterSpacing: 0.3, textTransform: 'uppercase' as const },
  heading: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 24, letterSpacing: 0.3 },
  label: { fontFamily: fonts.headingMedium, fontSize: 14, lineHeight: 18, letterSpacing: 1, textTransform: 'uppercase' as const },
  body: { fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  small: { fontSize: 14, lineHeight: 19 },
  caption: { fontSize: 12, lineHeight: 16 },
  stat: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30 },
};

export type TypographyVariant = keyof typeof typography;
