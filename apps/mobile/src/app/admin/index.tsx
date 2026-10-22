import { formatLapTime } from '@kartup/domain';
import { PENALTIES } from '@config/progression';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Card, EmptyState, LoadingState, Screen, SectionHeader, Text, Toggle } from '@/components/ui';
import { api } from '@/data';
import { useAuth } from '@/features/auth/AuthProvider';
import { toast } from '@/features/notifications/BannerHost';
import { phaseOf } from '@/features/sessions/components';
import { useRulesOrDefault } from '@/features/sessions/rules';
import { errorText } from '@/lib/errors';
import { formatDateTime, formatDay } from '@/lib/format';
import { useLiveQuery, useNow } from '@/lib/live';
import { spacing } from '@/theme/tokens';

/**
 * KartUP admin tools. Only admins can approve self-reported results (lobby
 * organizers can't), so friends can't farm XP for each other. The server checks the role.
 */
export default function AdminScreen() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const now = useNow(30_000);
  const rules = useRulesOrDefault();
  const isAdmin = profile?.role === 'admin';
  const reports = useLiveQuery('sessions', { queryKey: ['admin_self_reports'], enabled: isAdmin, queryFn: () => api.admin.pendingSelfReports() });
  const sessions = useQuery({ queryKey: ['admin_sessions'], enabled: isAdmin, queryFn: () => api.admin.sessions() });
  const fail = (e: unknown) => toast(errorText(e, t as never, i18n.language), 'danger');
  const done = () => qc.invalidateQueries();
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approve' | 'reject' | 'reject_false' }) => api.admin.reviewSelfReport(id, decision),
    onSuccess: done,
  });
  const official = useMutation({ mutationFn: ({ id, on }: { id: string; on: boolean }) => api.admin.setOfficialEvent(id, on), onSuccess: done });

  if (!isAdmin) return <EmptyState icon="lock-closed-outline" title={t('errors.admin_only')} />;
  if (reports.isPending || sessions.isPending) return <LoadingState />;

  return (
    <Screen>
      <Text variant="title">{t('admin.title')}</Text>
      <Text tone="muted">{t('admin.subtitle')}</Text>

      <SectionHeader title={t('admin.selfReports')} />
      <Text variant="small" tone="muted">
        {t('admin.selfReportsHint')}
      </Text>
      {!reports.data?.length ? (
        <Card>
          <Text tone="muted">{t('admin.none')}</Text>
        </Card>
      ) : (
        reports.data.map((r) => {
          const name = `${r.user.firstName} ${r.user.lastName}`;
          return (
            <Card key={r.id} style={styles.gapSm}>
              <View style={styles.row}>
                <Avatar uri={r.user.avatarUrl} name={name} size={36} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{name}</Text>
                  <Text variant="caption" tone="muted">
                    {r.trackName} · {formatDay(r.date, 'Europe/Bucharest', i18n.language)}
                  </Text>
                </View>
              </View>
              <Text>
                P{r.position}/{r.fieldSize} · {t('results.lapsShort', { count: r.laps })}
                {r.bestLapMs ? ` · ${t('results.bestLapShort')} ${formatLapTime(r.bestLapMs)}` : ''}
              </Text>
              <View style={styles.row}>
                <Button
                  title={t('admin.approve')}
                  size="md"
                  fullWidth={false}
                  onPress={() => review.mutate({ id: r.id, decision: 'approve' }, { onSuccess: () => toast(t('admin.approved')), onError: fail })}
                />
                <Button
                  title={t('admin.reject')}
                  size="md"
                  variant="secondary"
                  fullWidth={false}
                  onPress={() => review.mutate({ id: r.id, decision: 'reject' }, { onSuccess: () => toast(t('admin.rejected')), onError: fail })}
                />
              </View>
              <View style={styles.row}>
                <Button
                  title={t('admin.rejectFalse', { xp: PENALTIES.falseReport })}
                  size="md"
                  variant="danger"
                  fullWidth={false}
                  onPress={() => review.mutate({ id: r.id, decision: 'reject_false' }, { onSuccess: () => toast(t('admin.rejectedFalse')), onError: fail })}
                />
              </View>
            </Card>
          );
        })
      )}

      <SectionHeader title={t('admin.sessions')} />
      <Text variant="small" tone="muted">
        {t('admin.sessionsHint')}
      </Text>
      {!sessions.data?.length ? (
        <Card>
          <Text tone="muted">{t('admin.noSessions')}</Text>
        </Card>
      ) : (
        <Card padded={false}>
          {sessions.data.map((s) => {
            const awaiting = phaseOf(s, now, rules) === 'awaiting_results';
            return (
              <View key={s.id} style={styles.sessionRow}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1} onPress={() => router.push(`/session/${s.id}`)}>
                    {s.track.name}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {formatDateTime(s.startsAt, s.track.timezone, i18n.language)} · {s.paidCount}/{s.maxDrivers}
                  </Text>
                </View>
                {awaiting ? (
                  <Button title={t('admin.enterResults')} size="md" fullWidth={false} onPress={() => router.push(`/session/${s.id}/results`)} />
                ) : (
                  <View style={styles.toggle}>
                    <Text variant="caption" tone="muted">
                      {t('admin.official')}
                    </Text>
                    <Toggle
                      value={s.isOfficialEvent}
                      onValueChange={(on) => official.mutate({ id: s.id, on }, { onError: fail })}
                      accessibilityLabel={`${t('admin.official')}: ${s.track.name}`}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gapSm: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  toggle: { alignItems: 'center', gap: 2 },
});
