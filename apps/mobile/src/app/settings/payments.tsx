import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Chip, EmptyState, LoadingState, Screen, Text } from '@/components/ui';
import { usePaymentHistory } from '@/features/sessions/hooks';
import { formatDateTime, money } from '@/lib/format';
import { spacing } from '@/theme/tokens';

export default function PaymentsScreen() {
  const { t, i18n } = useTranslation();
  const payments = usePaymentHistory();
  if (payments.isPending) return <LoadingState />;
  return (
    <Screen>
      <Text variant="title">{t('payment.history')}</Text>
      {!payments.data?.length ? (
        <EmptyState icon="receipt-outline" title={t('payment.historyEmpty')} />
      ) : (
        <Card padded={false}>
          {payments.data.map((p) => (
            <Pressable key={p.id} style={styles.row} accessibilityRole="button" onPress={() => router.push(`/session/${p.sessionId}`)}>
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {p.trackName}
                </Text>
                <Text variant="caption" tone="muted">
                  {formatDateTime(p.startsAt, 'Europe/Bucharest', i18n.language)}
                </Text>
              </View>
              <View style={styles.right}>
                <Text variant="bodyStrong" style={p.status === 'refunded' || p.status === 'released' ? styles.strike : undefined}>
                  {money(p.amountMinor, p.currency, i18n.language)}
                </Text>
                <Chip label={t(`payment.status.${p.status}`)} tone={p.status === 'captured' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'} />
              </View>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  flex: { flex: 1, gap: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  strike: { textDecorationLine: 'line-through' },
});
