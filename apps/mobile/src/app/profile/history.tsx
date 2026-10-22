import { formatLapTime } from '@kartup/domain';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, EmptyState, LoadingState, Screen, Text } from '@/components/ui';
import type { ProgressEntry } from '@/data';
import { useMyId } from '@/features/auth/AuthProvider';
import { useProgressHistory } from '@/features/profile/api';
import { Breakdown } from '@/features/profile/Breakdown';
import { formatDay } from '@/lib/format';
import { spacing } from '@/theme/tokens';

/** Race history: verified results (km + XP with breakdown) and the user's unverified self-reports. */
export default function RaceHistory() {
  const { t, i18n } = useTranslation();
  const history = useProgressHistory(useMyId());
  if (history.isPending) return <LoadingState />;
  const rows = history.data ?? [];
  const xp = rows.reduce((a, p) => a + (p.xp ?? 0), 0);
  const km = rows.reduce((a, p) => a + (p.km ?? 0), 0);
  return (
    <Screen>
      <Text variant="title">{t('profile.raceHistory')}</Text>
      <Text variant="heading" tone="accent">
        {xp.toLocaleString(i18n.language)} XP · {(Math.round(km * 10) / 10).toLocaleString(i18n.language)} km
      </Text>
      <Button title={t('profile.addRace')} variant="secondary" size="md" onPress={() => router.push('/profile/self-report')} />
      {!rows.length ? (
        <EmptyState icon="trending-up-outline" title={t('profile.noRaces')} />
      ) : (
        <Card padded={false}>
          {rows.map((p) => (
            <Row key={p.id} p={p} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

function Row({ p }: { p: ProgressEntry }) {
  const { t, i18n } = useTranslation();
  const verified = p.verification === 'verified';
  const reviewLabel = p.review === 'pending' ? t('profile.pendingReview') : p.review === 'rejected' ? t('profile.rejectedReview') : null;
  return (
    <Pressable
      style={styles.row}
      accessibilityRole={p.sessionId ? 'button' : undefined}
      disabled={!p.sessionId}
      onPress={() => p.sessionId && router.push(`/session/${p.sessionId}/results`)}
    >
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {p.trackName}
        </Text>
        <Text variant="caption" tone="muted">
          {formatDay(p.date, 'Europe/Bucharest', i18n.language)} · P{p.position}/{p.fieldSize} · {t('results.lapsShort', { count: p.laps })}
          {p.bestLapMs ? ` · ${formatLapTime(p.bestLapMs)}` : ''}
        </Text>
        <View style={styles.chips}>
          <Chip label={verified ? t('profile.verified') : t('profile.unverified')} tone={verified ? 'success' : 'warning'} />
          {reviewLabel ? <Chip label={reviewLabel} tone={p.review === 'rejected' ? 'danger' : undefined} /> : <Chip label={t(`profile.source.${p.source}`)} />}
        </View>
        {p.breakdown ? <Breakdown b={p.breakdown} /> : null}
      </View>
      <View style={styles.right}>
        {verified ? (
          <>
            <Text variant="heading" tone="accent">
              +{p.xp} XP
            </Text>
            <Text variant="caption" tone="muted">
              {t('results.kmGained', { km: Math.round((p.km ?? 0) * 10) / 10 })}
            </Text>
          </>
        ) : (
          <Text variant="caption" tone="muted" align="right" style={styles.noProgress}>
            {t('profile.noProgress')}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  flex: { flex: 1, gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  right: { alignItems: 'flex-end', minWidth: 72 },
  noProgress: { maxWidth: 96 },
});
