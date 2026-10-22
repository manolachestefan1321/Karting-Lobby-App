import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { brand } from '@config/brand';
import { Wordmark } from '@/components/brand/Wordmark';
import { Card, ListRow, Screen, SectionHeader, SegmentedControl, Text, Toggle } from '@/components/ui';
import { api, type Locale, type NotificationGroup } from '@/data';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNotificationPrefs, useSetNotificationPrefs } from '@/features/notifications/hooks';
import { usePreferences, type ThemePreference } from '@/store/preferences';
import { spacing } from '@/theme/tokens';

const GROUPS: NotificationGroup[] = ['lobby', 'chat', 'reminders', 'results', 'ranking', 'account'];

export default function Settings() {
  const { t } = useTranslation();
  const { signOut, profile } = useAuth();
  const { locale, theme, setLocale, setTheme } = usePreferences();
  const prefs = useNotificationPrefs();
  const setPrefs = useSetNotificationPrefs();

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

      <SectionHeader title={t('settings.notifications')} />
      <Card padded={false}>
        {GROUPS.map((g) => (
          <View key={g} style={styles.prefRow}>
            <Text style={styles.flex}>{t(`settings.prefs.${g}`)}</Text>
            <Toggle
              value={g === 'account' ? true : (prefs.data?.[g] ?? true)}
              disabled={g === 'account' || !prefs.data}
              onValueChange={(v) => prefs.data && setPrefs.mutate({ ...prefs.data, [g]: v })}
              accessibilityLabel={t(`settings.prefs.${g}`)}
            />
          </View>
        ))}
      </Card>

      <SectionHeader title={t('settings.account')} />
      <Card padded={false}>
        <ListRow icon="receipt-outline" title={t('settings.payments')} onPress={() => router.push('/settings/payments')} />
        {profile?.role === 'admin' ? <ListRow icon="shield-checkmark-outline" title={t('settings.admin')} onPress={() => router.push('/admin')} /> : null}
        {api.kind === 'mock' ? <ListRow icon="construct-outline" title={t('dev.open')} subtitle={t('settings.previewMode')} onPress={() => router.push('/dev')} /> : null}
        <ListRow icon="log-out-outline" title={t('settings.signOut')} chevron={false} onPress={() => void signOut()} />
        <ListRow icon="trash-outline" title={t('settings.deleteAccount')} destructive onPress={() => router.push('/settings/delete-account')} />
      </Card>

      <SectionHeader title={t('settings.legal')} />
      <Card padded={false}>
        <ListRow icon="shield-checkmark-outline" title={t('settings.privacy')} onPress={() => router.push('/legal/privacy')} />
        <ListRow icon="document-text-outline" title={t('settings.terms')} onPress={() => router.push('/legal/terms')} />
        <ListRow icon="mail-outline" title={t('settings.contact')} subtitle={brand.supportEmail} onPress={() => void Linking.openURL(`mailto:${brand.supportEmail}`)} />
      </Card>

      <SectionHeader title={t('settings.about')} />
      <Card style={styles.about}>
        <Wordmark size={44} align="center" />
        <Text variant="caption" tone="faint" align="center">
          {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
          {api.kind === 'mock' ? ` · ${t('settings.previewMode')}` : ''}
        </Text>
        <Text variant="caption" tone="faint" align="center">
          © {new Date().getFullYear()} {brand.legalEntity}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minHeight: 52, gap: spacing.md },
  flex: { flex: 1 },
  about: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
});
