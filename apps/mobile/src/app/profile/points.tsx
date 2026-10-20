import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, EmptyState, LoadingState, Screen, Text } from '@/components/ui';
import { useMyId } from '@/features/auth/AuthProvider';
import { usePointsHistory } from '@/features/profile/api';
import { formatDay } from '@/lib/format';
import { spacing } from '@/theme/tokens';

export default function PointsHistory() {
  const { t, i18n } = useTranslation();
  const points = usePointsHistory(useMyId());
  if (points.isPending) return <LoadingState />;
  const total = (points.data ?? []).reduce((a, p) => a + p.points, 0);
  return (
    <Screen>
      <Text variant="title">{t('profile.pointsHistory')}</Text>
      <Text variant="heading" tone="accent">
        {t('common.pts', { count: total })}
      </Text>
      {!points.data?.length ? (
        <EmptyState icon="trending-up-outline" title={t('profile.noPoints')} />
      ) : (
        <Card padded={false}>
          {points.data.map((p) => (
            <Pressable key={p.id} style={styles.row} accessibilityRole="button" onPress={() => router.push(`/session/${p.sessionId}/results`)}>
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {p.trackName}
                </Text>
                <Text variant="caption" tone="muted">
                  {formatDay(p.date, 'Europe/Bucharest', i18n.language)} · P{p.position}/{p.fieldSize}
                </Text>
              </View>
              <Text variant="heading" tone={p.points > 0 ? 'accent' : 'muted'}>
                +{p.points}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  flex: { flex: 1, gap: 2 },
});
