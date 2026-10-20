import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { brand } from '@config/brand';
import { Card, ListRow, Screen, SectionHeader, SegmentedControl, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Locale } from '@/lib/types';
import { usePreferences, type ThemePreference } from '@/store/preferences';
import { spacing } from '@/theme/tokens';

export default function Settings() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { locale, theme, setLocale, setTheme } = usePreferences();

  return (
    <Screen>
      <Text variant="title">{t('settings.title')}</Text>

      <SectionHeader title={t('settings.preferences')} />
      <Card style={styles.gap}>
        <Text variant="label" tone="muted">
          {t('settings.language')}
        </Text>
        <SegmentedControl<Locale>
          value={locale ?? 'en'}
          onChange={setLocale}
          accessibilityLabel={t('settings.language')}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ro', label: 'Română' },
          ]}
        />
        <Text variant="label" tone="muted">
          {t('settings.theme')}
        </Text>
        <SegmentedControl<ThemePreference>
          value={theme}
          onChange={setTheme}
          accessibilityLabel={t('settings.theme')}
          options={[
            { value: 'dark', label: t('settings.themeDark') },
            { value: 'light', label: t('settings.themeLight') },
            { value: 'system', label: t('settings.themeSystem') },
          ]}
        />
      </Card>

      <SectionHeader title={t('settings.legal')} />
      <Card padded={false}>
        <ListRow icon="shield-checkmark-outline" title={t('settings.privacy')} onPress={() => Linking.openURL(brand.privacyUrl)} />
        <ListRow icon="document-text-outline" title={t('settings.terms')} onPress={() => Linking.openURL(brand.termsUrl)} />
        <ListRow icon="mail-outline" title={t('settings.contact')} subtitle={brand.supportEmail} onPress={() => Linking.openURL(`mailto:${brand.supportEmail}`)} />
      </Card>

      <SectionHeader title={t('settings.account')} />
      <Card padded={false}>
        <ListRow icon="log-out-outline" title={t('settings.signOut')} chevron={false} onPress={() => void signOut()} />
        <ListRow icon="trash-outline" title={t('settings.deleteAccount')} destructive onPress={() => router.push('/settings/delete-account')} />
      </Card>

      <View style={styles.version}>
        <Text variant="caption" tone="faint">
          {brand.name} · {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  version: { alignItems: 'center', paddingVertical: spacing.lg },
});
