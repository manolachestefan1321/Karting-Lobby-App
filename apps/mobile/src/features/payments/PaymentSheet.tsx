import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Text } from '@/components/ui';
import { api, type PaymentIntentInfo, type PaymentOutcome } from '@/data';
import { money } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

/**
 * Payment sheet. In the web preview this is a fake card form (test mode, no money).
 * With the real backend it is replaced by Stripe's native PaymentSheet, keeping the
 * same flow: server creates the intent → card authorized → server confirms the seat.
 */
export function PaymentSheet({
  intent,
  onClose,
  onResult,
}: {
  intent: PaymentIntentInfo | null;
  onClose: () => void;
  onResult: (outcome: PaymentOutcome) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [card, setCard] = useState('4242 4242 4242 4242');
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  if (!intent) return null;
  const p = intent.price;
  const fmt = (m: number) => money(m, p.currency, i18n.language);

  const pay = async () => {
    setBusy(true);
    setDeclined(false);
    try {
      const outcome = await api.payments.confirm(intent, card);
      await qc.invalidateQueries();
      if (outcome.status === 'declined') setDeclined(true);
      else onResult(outcome);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={busy ? undefined : onClose} accessibilityLabel={t('common.cancel')} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.header}>
          <Text variant="heading" style={styles.flex}>
            {t('payment.title')}
          </Text>
          <Pressable onPress={onClose} disabled={busy} accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </Pressable>
        </View>
        <View style={[styles.test, { borderColor: colors.warning }]}>
          <Text variant="caption" style={{ color: colors.warning, fontWeight: '700' }}>
            {t('payment.testMode')}
          </Text>
        </View>

        <View style={styles.lines}>
          <Line label={t('payment.breakdownTrack')} value={fmt(p.trackMinor)} />
          <Line label={t('payment.breakdownFee')} value={fmt(p.feeMinor)} />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <Line label={t('payment.total')} value={fmt(p.totalMinor)} strong />
        </View>

        {intent.nonRefundable ? (
          <Text variant="small" tone="danger">
            {t('lobby.nonRefundable')}
          </Text>
        ) : null}

        <View style={[styles.cardBox, { borderColor: declined ? colors.danger : colors.border, backgroundColor: colors.background }]}>
          <Ionicons name="card-outline" size={20} color={colors.textMuted} />
          <TextInput
            value={card}
            onChangeText={(v) => {
              setCard(v);
              setDeclined(false);
            }}
            keyboardType="number-pad"
            accessibilityLabel={t('payment.cardNumber')}
            placeholder={t('payment.cardNumber')}
            placeholderTextColor={colors.textFaint}
            style={[styles.cardInput, { color: colors.text }]}
          />
          <Text variant="small" tone="muted">
            12/30 · 123
          </Text>
        </View>
        <Text variant="caption" tone="faint">
          {t('payment.testCards')}
        </Text>
        {declined ? (
          <Text tone="danger" accessibilityLiveRegion="polite">
            {t('payment.declined')}
          </Text>
        ) : null}

        <Button
          title={busy ? t('payment.processing') : t('payment.pay', { amount: fmt(p.totalMinor) })}
          onPress={() => void pay()}
          loading={busy}
          icon={busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="lock-closed" size={16} color="#fff" />}
        />
        <Text variant="caption" tone="faint" align="center">
          {t('payment.authorizationNote')}
        </Text>
      </View>
    </Modal>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Text variant={strong ? 'bodyStrong' : 'body'} tone={strong ? 'default' : 'muted'}>
        {label}
      </Text>
      <Text variant={strong ? 'heading' : 'body'}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  test: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  lines: { gap: spacing.xs },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sep: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xs },
  cardBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 50 },
  cardInput: { flex: 1, fontSize: 16, minHeight: 44 },
});
