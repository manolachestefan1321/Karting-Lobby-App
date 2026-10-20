import { formatLapTime, rankProgress } from '@kartapp/domain';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar, Card, CheckeredStripe, EmptyState, ProgressBar, SectionHeader, Text } from '@/components/ui';
import { publicStorageUrl } from '@/lib/supabase';
import type { PublicProfile, RankTier, TrackExperience } from '@/lib/types';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export function RankBadge({ tier }: { tier: RankTier }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.badge, { backgroundColor: tier.color }]}>
      <Text variant="label" style={styles.badgeText}>
        {t(`ranks.${tier.key}` as 'ranks.rookie')}
      </Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="stat">{value}</Text>
      <Text variant="caption" tone="muted" style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

export function ProfileView({
  profile,
  tiers,
  experience,
  cityName,
  actions,
  experienceAction,
  onExperiencePress,
}: {
  profile: PublicProfile;
  tiers: RankTier[];
  experience: TrackExperience[];
  cityName?: string;
  actions?: ReactNode;
  experienceAction?: ReactNode;
  onExperiencePress?: (trackId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const name = `${profile.first_name} ${profile.last_name}`;
  const progress = tiers.length ? rankProgress(profile.total_points, tiers) : null;
  const since = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(new Date(profile.created_at));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Avatar uri={publicStorageUrl('avatars', profile.avatar_path)} name={name} size={104} ringColor={progress?.current.color} />
        <Text variant="title" align="center">
          {name}
        </Text>
        <View style={styles.metaRow}>
          {progress ? <RankBadge tier={progress.current} /> : null}
          {cityName ? (
            <View style={styles.meta}>
              <Ionicons name="location-outline" size={14} color={colors.textMuted} />
              <Text variant="small" tone="muted">
                {cityName}
              </Text>
            </View>
          ) : null}
          {profile.age != null ? (
            <Text variant="small" tone="muted">
              {t('profile.age', { count: profile.age })}
            </Text>
          ) : null}
        </View>
        {profile.bio ? (
          <Text tone="muted" align="center">
            {profile.bio}
          </Text>
        ) : null}
        {actions}
      </View>

      <Card style={styles.statsCard}>
        <Stat label={t('profile.points')} value={profile.total_points} />
        <Stat label={t('profile.sessions')} value={profile.sessions_raced} />
        <Stat label={t('profile.tracks')} value={profile.tracks_raced} />
        <Stat label={t('profile.wins')} value={profile.wins} />
      </Card>

      {progress ? (
        <Card style={styles.gapSm}>
          <View style={styles.rowBetween}>
            <Text variant="label" tone="muted">
              {t('profile.rank')}
            </Text>
            <Text variant="small" tone="muted">
              {progress.next
                ? t('profile.pointsToNext', { points: progress.pointsToNext, rank: t(`ranks.${progress.next.key}` as 'ranks.rookie') })
                : t('profile.maxRank')}
            </Text>
          </View>
          <ProgressBar progress={progress.progress} color={progress.current.color} label={t('profile.rank')} />
        </Card>
      ) : null}

      <SectionHeader title={t('profile.experience')} right={experienceAction} />
      {experience.length === 0 ? (
        <Card>
          <EmptyState icon="speedometer-outline" title={t('profile.noExperienceTitle')} body={t('profile.noExperienceBody')} />
        </Card>
      ) : (
        experience.map((e) => (
          <Card
            key={e.track_id}
            style={styles.expRow}
            onPress={onExperiencePress ? () => onExperiencePress(e.track_id) : undefined}
            accessibilityLabel={e.tracks?.name ?? undefined}
          >
            <View style={styles.flex}>
              <Text variant="heading">{e.tracks?.name ?? '—'}</Text>
              <Text variant="small" tone="muted">
                {t(`profile.level.${e.level}`)} · {t('profile.sessionsAt', { count: e.sessions_count })}
              </Text>
            </View>
            {e.best_lap_ms ? (
              <View style={styles.lap}>
                <Text variant="caption" tone="muted">
                  {t('profile.bestLap')}
                </Text>
                <Text variant="heading" tone="accent">
                  {formatLapTime(e.best_lap_ms)}
                </Text>
              </View>
            ) : null}
          </Card>
        ))
      )}

      <View style={styles.footer}>
        <CheckeredStripe squares={12} size={5} />
        <Text variant="caption" tone="faint">
          {t('profile.memberSince', { date: since })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  header: { alignItems: 'center', gap: spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4, transform: [{ skewX: '-8deg' }] },
  badgeText: { color: '#fff' },
  statsCard: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statLabel: { textTransform: 'uppercase', letterSpacing: 0.8 },
  gapSm: { gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  expRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  lap: { alignItems: 'flex-end' },
  footer: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
});
