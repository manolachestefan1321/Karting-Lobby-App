import { brand } from '@config/brand';

/**
 * Design tokens.
 * Light theme: background #E2DAC2 (cream), text / tab bar / secondary buttons #181818,
 * main color #EC4624 (primary buttons, selections), red "danger" buttons #F39120.
 * Dark theme: its own palette (below).
 * Body text contrast is ≥ 4.5:1 (WCAG AA); small colored text uses deeper shades for that.
 */
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
  /** Readable text version of `danger` (the button color can be too light for small text). */
  dangerText: string;
  onDanger: string;
  /** Toggle switches: one accent color when on, neutral grey when off, white thumb. */
  toggleOn: string; toggleOff: string; toggleThumb: string;
  /** The 30% color: tab bar, secondary buttons, segmented controls. */
  secondary: string; onSecondary: string; onSecondaryMuted: string;
} = {
  ...shared,
  // Light theme: background #E2DAC2, main color #EC4624, red (danger) buttons #F39120.
  accent: '#EC4624',
  accentPressed: '#C8361A',
  accentText: '#B3301A', // deeper shade so small red-orange text stays readable on cream
  danger: '#F39120',
  dangerText: '#9A5208',
  onDanger: SECONDARY,
  toggleOn: '#EC4624',
  toggleOff: '#A7A39A',
  toggleThumb: '#FFFFFF',
  background: '#E2DAC2',
  surface: '#EDE7D7',
  surfaceAlt: '#D5CAAC',
  border: '#C2B591',
  text: SECONDARY,
  textMuted: '#45403A',
  textFaint: '#62594C',
  overlay: 'rgba(24,24,24,0.45)',
  success: '#1B7A35',
  warning: '#7F5300',
  secondary: SECONDARY,
  onSecondary: '#E2DAC2',
  onSecondaryMuted: '#ADA48F',
};

/**
 * Dark theme — its own palette:
 *  background #222A2A (iron core), main color #F39120 (heat marker: primary buttons,
 *  selections, highlights), #EC4624 (rust signal: cancel / penalty / danger),
 *  #4FBBBC (industrial aqua: success, e.g. "You're in"), text #E2DAC2 (architectural cream).
 */
export const darkColors: typeof lightColors = {
  ...shared,
  accent: '#F39120',
  accentPressed: '#C9741A',
  onAccent: '#222A2A', // dark text on orange (white would be too faint)
  accentText: '#F39120',
  success: '#4FBBBC',
  danger: '#EC4624',
  dangerText: '#EC4624',
  onDanger: '#222A2A',
  toggleOn: '#F39120',
  toggleOff: '#5C6767',
  toggleThumb: '#FFFFFF',
  warning: '#F3B33D',
  background: '#222A2A',
  // Cards sit a step lighter than the background so they stay visible.
  surface: '#2C3636',
  surfaceAlt: '#364242',
  border: '#465454',
  text: '#E2DAC2',
  textMuted: '#B4AE9E',
  textFaint: '#8C928A',
  overlay: 'rgba(0,0,0,0.6)',
  secondary: '#1A2121',
  onSecondary: '#E2DAC2',
  onSecondaryMuted: '#8C9A99',
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
