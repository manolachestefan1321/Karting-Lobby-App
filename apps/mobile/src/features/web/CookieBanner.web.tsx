import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text, Toggle } from '@/components/ui';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { useConsent } from './consent';

/**
 * Website cookie banner (EU rules, EDPB guidelines 05/2020 and the 2023 cookie-banner report):
 *  - shown before any optional storage; statistics are OFF by default (no pre-ticked boxes);
 *  - "Refuse all" sits next to "Accept all", same size and style (no nudging);
 *  - every category is explained: purpose, what is stored, for how long, where;
 *  - the site works the same if you refuse (no cookie wall);
 *  - "Cookie settings" reopens it at any time, to change or withdraw consent.
 */
export function CookieBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const locale = usePreferences((s) => s.locale) ?? 'ro';
  const { choice, settingsOpen, decide, closeSettings } = useConsent();
  const [analytics, setAnalytics] = useState(choice?.analytics ?? false);

  useEffect(() => {
    if (settingsOpen) setAnalytics(choice?.analytics ?? false);
  }, [settingsOpen, choice]);

  if (choice && !settingsOpen) return null;
  const detailed = settingsOpen;
  const privacy = (
    <Text variant="small" tone="accent" onPress={() => router.push('/legal/privacy')} accessibilityRole="link">
      {t('cookies.privacyLink')}
    </Text>
  );

  return (
    <View style={styles.layer} pointerEvents="box-none">
      <View
        accessibilityRole={detailed ? undefined : 'alert'}
        aria-modal={detailed}
        accessibilityLabel={t('cookies.title')}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, detailed && styles.cardTall]}
      >
        <ScrollView contentContainerStyle={styles.body}>
          <Text variant="heading">{detailed ? t('cookies.settingsTitle') : t('cookies.title')}</Text>
          <Text variant="small" tone="muted">
            {t('cookies.intro')} {privacy}
          </Text>

          {detailed ? (
            <>
              <Category
                title={t('cookies.necessary.title')}
                body={t('cookies.necessary.body')}
                items={t('cookies.necessary.items')}
                right={<Text variant="caption" tone="muted">{t('cookies.alwaysOn')}</Text>}
              />
              <Category
                title={t('cookies.analytics.title')}
                body={t('cookies.analytics.body')}
                items={t('cookies.analytics.items')}
                right={<Toggle value={analytics} onValueChange={setAnalytics} accessibilityLabel={t('cookies.analytics.title')} />}
              />
              <Category title={t('cookies.marketing.title')} body={t('cookies.marketing.body')} right={<Text variant="caption" tone="muted">{t('cookies.notUsed')}</Text>} />
            </>
          ) : null}
        </ScrollView>

        {/* Same size and style for every choice: refusing is as easy as accepting.
            "Refuse all" and "Accept all" always share one row, at equal width. */}
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button title={t('cookies.refuseAll')} variant="secondary" size="md" onPress={() => decide(false, locale)} />
          </View>
          <View style={styles.action}>
            <Button title={t('cookies.acceptAll')} variant="secondary" size="md" onPress={() => decide(true, locale)} />
          </View>
        </View>
        {detailed ? (
          <Button title={t('cookies.save')} variant="secondary" size="md" onPress={() => decide(analytics, locale)} />
        ) : (
          <Button title={t('cookies.customize')} variant="secondary" size="md" onPress={() => useConsent.getState().openSettings()} />
        )}
        {detailed && choice ? (
          <Text variant="caption" tone="muted" style={styles.close} onPress={closeSettings} accessibilityRole="button">
            {t('cookies.close')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Category({ title, body, items, right }: { title: string; body: string; items?: string; right: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.category, { borderColor: colors.border }]}>
      <View style={styles.categoryHead}>
        <Text variant="bodyStrong" style={styles.flex}>
          {title}
        </Text>
        {right}
      </View>
      <Text variant="small" tone="muted">
        {body}
      </Text>
      {items ? (
        <Text variant="caption" tone="muted">
          {items}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, alignItems: 'center', zIndex: 900 },
  card: { width: '100%', maxWidth: 760, borderWidth: 1, borderRadius: 14, padding: spacing.lg, gap: spacing.md, boxShadow: '0 8px 30px rgba(0,0,0,0.25)' },
  cardTall: { maxHeight: '85vh' as unknown as number },
  body: { gap: spacing.sm },
  category: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: 4 },
  categoryHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  close: { textAlign: 'center', textDecorationLine: 'underline' },
  flex: { flex: 1 },
});
