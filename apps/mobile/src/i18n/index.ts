import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import type { Locale } from '@/lib/types';
import en from './en';
import ro from './ro';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ro'];

/** First launch: Romanian if the phone is in Romanian, otherwise English. */
export function detectDeviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode ?? 'en';
  return code === 'ro' ? 'ro' : 'en';
}

export function initI18n(locale: Locale) {
  if (i18n.isInitialized) {
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
    return i18n;
  }
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ro: { translation: ro } },
    lng: locale,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return i18n;
}

export { i18n };
