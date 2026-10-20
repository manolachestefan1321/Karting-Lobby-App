/**
 * Branding — the ONLY place to change the app's name, identifiers, colors and logo.
 *
 * When the final name/logo are decided:
 *  1. Change the values below.
 *  2. Replace the image files referenced in `assets` (keep the same sizes).
 *  3. Rebuild with EAS (bundle IDs can't change after the first store release!).
 */
export const brand = {
  /** Display name shown under the app icon and in the stores. */
  name: 'KartApp',
  /** Lowercase, no spaces. Used for the Expo project slug and deep links (kartapp://). */
  slug: 'kartapp',
  scheme: 'kartapp',
  /** Reverse-domain identifiers. Must be unique on the stores. */
  iosBundleId: 'com.kartapp.app',
  androidPackage: 'com.kartapp.app',

  tagline: { en: 'Find drivers. Fill the grid. Race.', ro: 'Găsește piloți. Umple grila. Concurează.' },

  colors: {
    /** The single strong accent color (racing red). */
    accent: '#E10600',
    accentPressed: '#B30500',
    /** Background of splash screen and Android adaptive icon. */
    splashBackground: '#0B0B0D',
  },

  assets: {
    icon: './assets/images/icon.png',
    adaptiveIconForeground: './assets/images/android-icon-foreground.png',
    adaptiveIconBackground: './assets/images/android-icon-background.png',
    adaptiveIconMonochrome: './assets/images/android-icon-monochrome.png',
    splash: './assets/images/splash-icon.png',
    favicon: './assets/images/favicon.png',
  },

  /** Contact / legal — shown in Settings, privacy policy and terms. */
  supportEmail: 'support@kartapp.example',
  legalEntity: 'KartApp SRL (placeholder)',
  /** Public URLs of the legal pages (served by apps/admin). */
  privacyUrl: 'https://kartapp.example/privacy',
  termsUrl: 'https://kartapp.example/terms',
} as const;

export type Brand = typeof brand;
