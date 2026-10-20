import { formatLapTime, rankProgress } from '@kartup/domain';
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar, Card, CheckeredStripe, EmptyState, ProgressBar, SectionHeader, Text } from '@/components/ui';
import type { PublicProfile, RankTier, TrackExperience } from '@/data';
import { formatDateTime } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export function RankBadge({ tier, small }: { tier: RankTier; small?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.badge, small && styles.badgeSmall, { backgroundColor: tier.color }]}>
      <Text variant="label" style={[styles.badgeText, small && { fontSize: 11, lineHeight: 14 }]}>
        {t(`ranks.${tier.key}` as 'ranks.rookie')}
      </Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="stat">{value}</Text>
      <Text variant="caption" tone="muted" style={styles.statLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Red card shown on a profile while a ban is active (own and public profile). */
export function BanCard({ profile, action }: { profile: PublicProfile; action?: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const ban = profile.activeBan;
  if (!ban) return null;
  return (
    <Card style={[styles.ban, { borderColor: colors.danger }]}>
      <View style={styles.banRow}>
        <Ionicons name="ban" size={22} color={colors.danger} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" tone="danger">
            {ban.endsAt ? t('profile.banActive', { time: formatDateTime(ban.endsAt, 'Europe/Bucharest', i18n.language) }) : t('profile.banAdmin')}
          </Text>
          <Text variant="small" tone="muted">
            {ban.reason === 'no_show' && ban.offense ? t('profile.banReason', { offense: ban.offense }) : t('profile.banAdmin')}
            {ban.appealStatus === 'pending' ? ` · ${t('profile.appealPending')}` : ban.appealStatus === 'rejected' ? ` · ${t('profile.appealRejected')}` : ''}
          </Text>
        </View>
      </View>
      {action}
    </Card>
  );
}

export function ProfileView({
  profile,
  tiers,
  experience,
  cityName,
  actions,
  banAction,
  experienceAction,
  onExperiencePress,
  footer,
}: {
  profile: PublicProfile;
  tiers: RankTier[];
  experience: TrackExperience[];
  cityName?: string;
  actions?: ReactNode;
  banAction?: ReactNode;
  experienceAction?: ReactNode;
  onExperiencePress?: (trackId: string) => void;
  footer?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const name = `${profile.firstName} ${profile.lastName}`;
  const progress = tiers.length ? rankProgress(profile.totalPoints, tiers) : null;
  const since = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(new Date(profile.createdAt));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Avatar uri={profile.avatarUrl} name={name} size={104} ringColor={progress?.current.color} />
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
          {profile.noShowCount > 0 ? (
            <Text variant="small" tone="danger">
              {t('profile.noShows', { count: profile.noShowCount })}
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

      <BanCard profile={profile} action={banAction} />

      <Card style={styles.statsCard}>
        <Stat label={t('profile.points')} value={profile.totalPoints} />
        <Stat label={t('profile.sessions')} value={profile.sessionsRaced} />
        <Stat label={t('profile.tracks')} value={profile.tracksRaced} />
        <Stat label={t('profile.wins')} value={profile.wins} />
      </Card>

      {progress ? (
        <Card style={styles.gapSm}>
          <View style={styles.rowBetween}>
            <Text variant="label" tone="muted">
              {t('profile.rank')}
            </Text>
            <Text variant="small" tone="muted">
              {progress.next ? t('profile.pointsToNext', { points: progress.pointsToNext, rank: t(`ranks.${progress.next.key}` as 'ranks.rookie') }) : t('profile.maxRank')}
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
          <Card key={e.trackId} style={styles.expRow} onPress={onExperiencePress ? () => onExperiencePress(e.trackId) : undefined} accessibilityLabel={e.trackName}>
            <View style={styles.flex}>
              <Text variant="heading">{e.trackName}</Text>
              <Text variant="small" tone="muted">
                {t(`profile.level.${e.level}`)} · {t('profile.sessionsAt', { count: e.sessionsCount })}
              </Text>
            </View>
            {e.bestLapMs ? (
              <View style={styles.lap}>
                <Text variant="caption" tone="muted">
                  {t('profile.bestLap')}
                </Text>
                <Text variant="heading" tone="accent">
                  {formatLapTime(e.bestLapMs)}
                </Text>
              </View>
            ) : null}
          </Card>
        ))
      )}

      {footer}

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
  badgeSmall: { paddingHorizontal: 6, paddingVertical: 0 },
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
  ban: { gap: spacing.md, borderWidth: 1.5 },
  banRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
