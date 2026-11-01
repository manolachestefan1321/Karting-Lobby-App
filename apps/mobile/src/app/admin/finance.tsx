import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, confirmDialog, EmptyState, LoadingState, Screen, SectionHeader, Text } from '@/components/ui';
import { api } from '@/data';
import { useAuth } from '@/features/auth/AuthProvider';
import { toast } from '@/features/notifications/BannerHost';
import { errorText } from '@/lib/errors';
import { formatDate, money } from '@/lib/format';
import { useLiveQuery } from '@/lib/live';
import { spacing } from '@/theme/tokens';

/**
 * Owner money screen: KartUP's own earnings (the platform fee of each seat, minus
 * Stripe's card fee) and cash-outs to the owner's bank account via Stripe.
 */
export default function OwnerFinanceScreen() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const isAdmin = profile?.role === 'admin';
  const finance = useLiveQuery('sessions', { queryKey: ['owner_finance'], enabled: isAdmin, queryFn: () => api.admin.finance() });
  const cashout = useMutation({ mutationFn: () => api.admin.cashout(), onSuccess: () => qc.invalidateQueries({ queryKey: ['owner_finance'] }) });

  if (!isAdmin) return <EmptyState icon="lock-closed-outline" title={t('errors.admin_only')} />;
  if (finance.isPending || !finance.data) return <LoadingState />;
  const f = finance.data;
  const fmt = (minor: number) => money(minor, f.currency, i18n.language);

  const onCashout = async () => {
    const ok = await confirmDialog({
      title: t('owner.confirmTitle', { amount: fmt(f.availableMinor) }),
      message: t('owner.confirmMessage', { last4: f.bankLast4 }),
      confirmText: t('owner.cashout'),
      cancelText: t('common.cancel'),
    });
    if (!ok) return;
    cashout.mutate(undefined, {
      onSuccess: (c) => toast(t('owner.sent', { amount: fmt(c.amountMinor), date: formatDate(c.arrivesAt, i18n.language) })),
      onError: (e) => toast(errorText(e, t as never, i18n.language), 'danger'),
    });
  };

  return (
    <Screen>
      <Text variant="title">{t('owner.title')}</Text>
      <Text tone="muted">{t('owner.subtitle')}</Text>

      <Card style={styles.gap}>
        <Text variant="label" tone="muted">
          {t('owner.available')}
        </Text>
        <Text variant="display">{fmt(f.availableMinor)}</Text>
        <Text variant="small" tone="muted">
          {t('owner.pending', { amount: fmt(f.pendingMinor) })}
        </Text>
        <Button title={t('owner.cashout')} loading={cashout.isPending} disabled={f.availableMinor <= 0} onPress={() => void onCashout()} />
        <Text variant="caption" tone="muted" align="center">
          {t('owner.bank', { last4: f.bankLast4 })}
        </Text>
      </Card>

      <SectionHeader title={t('owner.breakdown')} />
      <Card style={styles.gap}>
        <Row label={t('owner.seats')} value={String(f.seats)} />
        <Row label={t('owner.grossFees')} value={fmt(f.grossFeesMinor)} />
        <Row label={t('owner.stripeFees')} value={`−${fmt(f.stripeFeesMinor)}`} />
        <Row label={t('owner.net')} value={fmt(f.grossFeesMinor - f.stripeFeesMinor)} strong />
        <Row label={t('owner.cashedOut')} value={fmt(f.cashedOutMinor)} />
        <Text variant="caption" tone="muted">
          {t('owner.stripeHint')}
        </Text>
      </Card>

      <SectionHeader title={t('owner.history')} />
      {!f.cashouts.length ? (
        <Card>
          <Text tone="muted">{t('owner.noCashouts')}</Text>
        </Card>
      ) : (
        <Card padded={false}>
          {f.cashouts.map((c) => (
            <View key={c.id} style={styles.item}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{fmt(c.amountMinor)}</Text>
                <Text variant="caption" tone="muted">
                  {formatDate(c.createdAt, i18n.language)} · {t('owner.arrives', { date: formatDate(c.arrivesAt, i18n.language) })}
                </Text>
              </View>
              <Chip label={t(`owner.status.${c.status}`)} tone={c.status === 'paid' ? 'success' : 'warning'} />
            </View>
          ))}
        </Card>
      )}

      {api.kind === 'mock' ? (
        <Text variant="caption" tone="muted">
          {t('owner.demoNote')}
        </Text>
      ) : null}
    </Screen>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.flex} variant={strong ? 'bodyStrong' : 'body'}>
        {label}
      </Text>
      <Text variant={strong ? 'bodyStrong' : 'body'}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  flex: { flex: 1, gap: 2 },
});
