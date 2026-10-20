import type { ConfigContext, ExpoConfig } from 'expo/config';
import { brand } from '../../config/brand.ts';

/**
 * Expo app configuration. Branding comes from config/brand.ts;
 * secrets/IDs come from environment variables (see .env.example).
 *
 * APP_VARIANT is set per build profile in eas.json so development and preview
 * builds can be installed next to the production app.
 */
const variant = process.env.APP_VARIANT ?? 'production';
const suffix = variant === 'production' ? '' : `.${variant}`;
const nameSuffix = variant === 'production' ? '' : variant === 'development' ? ' (Dev)' : ' (Preview)';

// The iOS URL scheme for Google Sign-In is the reversed iOS client ID.
const googleIosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  ? process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.split('.').reverse().join('.')
  : 'com.googleusercontent.apps.placeholder';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: brand.name + nameSuffix,
  slug: brand.slug,
  scheme: brand.scheme,
  version: '1.0.0',
  orientation: 'portrait',
  icon: brand.assets.icon,
  userInterfaceStyle: 'automatic',
  backgroundColor: brand.colors.splashBackground,
  ios: {
    bundleIdentifier: brand.iosBundleId + suffix,
    supportsTablet: false,
    usesAppleSignIn: true,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: brand.androidPackage + suffix,
    adaptiveIcon: {
      backgroundColor: brand.colors.splashBackground,
      foregroundImage: brand.assets.adaptiveIconForeground,
      backgroundImage: brand.assets.adaptiveIconBackground,
      monochromeImage: brand.assets.adaptiveIconMonochrome,
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: 'single',
    name: brand.name,
    shortName: brand.name,
    description: brand.slogan,
    themeColor: brand.colors.splashBackground,
    favicon: brand.assets.favicon,
  },
  plugins: [
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    'expo-apple-authentication',
    '@react-native-community/datetimepicker',
    ['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Allow $(PRODUCT_NAME) to access your photos so you can choose a profile picture and attach race timing sheets.',
        cameraPermission:
          'Allow $(PRODUCT_NAME) to use the camera so you can take a profile picture and photograph race timing sheets.',
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: brand.colors.splashBackground,
        image: brand.assets.splash,
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    appVariant: variant,
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
});
