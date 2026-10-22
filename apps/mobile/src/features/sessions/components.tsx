import { sessionPhase, type SessionPhase } from '@kartup/domain';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Chip, Text } from '@/components/ui';
import type { KartSession, RankTier } from '@/data';
import { formatDay, formatTime, money } from '@/lib/format';
import { useMyId } from '@/features/auth/AuthProvider';
import { RULES_FALLBACK, useRulesOrDefault } from './rules';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export function phaseOf(s: KartSession, now: Date, rules = RULES_FALLBACK): SessionPhase {
  return sessionPhase(
    { startsAt: new Date(s.startsAt), cancelled: !!s.cancelledAt, resultsStatus: s.resultsStatus === 'rejected' ? null : s.resultsStatus },
    now,
    rules,
  );
}

export function PhaseBadge({ phase }: { phase: SessionPhase }) {
  const { t } = useTranslation();
  const tone = phase === 'cancelled' ? 'danger' : phase === 'checkin' || phase === 'locked' ? 'warning' : phase === 'final' ? 'success' : phase === 'open' ? undefined : 'accent';
  return <Chip label={t(`sessions.phase.${phase}`)} tone={tone} />;
}

export function SessionCard({ session, now, tiers, showDate }: { session: KartSession; now: Date; tiers?: RankTier[]; showDate?: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const rules = useRulesOrDefault();
  const myId = useMyId();
  const tz = session.track.timezone;
  const spotsLeft = Math.max(0, session.maxDrivers - session.paidCount);
  const phase = phaseOf(session, now, rules);
  const minTier = tiers?.find((x) => x.id === session.minRankTierId);
  const fill = session.paidCount / session.maxDrivers;

  return (
    <Card
      onPress={() => router.push(`/session/${session.id}`)}
      accessibilityLabel={`${session.track.name}, ${formatDay(session.startsAt, tz, i18n.language)} ${formatTime(session.startsAt, tz, i18n.language)}`}
      style={styles.card}
    >
      <View style={styles.top}>
        <View style={styles.timeCol}>
          <Text variant="title" style={styles.time}>
            {formatTime(session.startsAt, tz, i18n.language)}
          </Text>
          {showDate ? (
            <Text variant="caption" tone="muted">
              {formatDay(session.startsAt, tz, i18n.language)}
            </Text>
          ) : null}
          <View style={[styles.speed, { backgroundColor: colors.accent }]} />
        </View>
        <View style={styles.main}>
          <Text variant="heading" numberOfLines={1}>
            {session.track.name}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {t('sessions.hostedBy', { name: `${session.host.firstName} ${session.host.lastName}` })}
          </Text>
        </View>
        <View style={styles.priceCol}>
          <Text variant="heading">{money(session.price.totalMinor, session.price.currency, i18n.language)}</Text>
          <Text variant="caption" tone="muted">
            {t('sessions.perDriver')}
          </Text>
        </View>
      </View>
      <View style={styles.chips}>
        {session.host.id === myId ? <Chip label={t('sessions.youHost')} tone="accent" icon="flag" /> : null}
        {session.myStatus === 'confirmed' || session.myStatus === 'attended' ? (
          <Chip label={t('sessions.youreIn')} tone="success" icon="checkmark" />
        ) : session.myStatus === 'joined_unpaid' ? (
          <Chip label={t('sessions.inLobbyUnpaid')} tone="warning" />
        ) : null}
        {session.isOfficialEvent ? <Chip label={t('sessions.official')} tone="accent" icon="trophy" /> : null}
        {phase !== 'open' ? <PhaseBadge phase={phase} /> : null}
        {session.minSkill ? <Chip label={t('sessions.minSkill', { level: t(`profile.level.${session.minSkill}`) })} /> : null}
        {minTier ? <Chip label={t('sessions.minRank', { rank: minTier.name })} /> : null}
      </View>
      <View style={styles.fillRow}>
        <View style={[styles.fillTrack, { backgroundColor: colors.surfaceAlt }]}>
          <View style={[styles.fillBar, { width: `${fill * 100}%`, backgroundColor: spotsLeft === 0 ? colors.textMuted : colors.accent }]} />
        </View>
        <Text variant="caption" tone={spotsLeft === 0 ? 'muted' : 'default'}>
          {spotsLeft === 0 ? t('sessions.full') : t('sessions.spotsLeft', { count: spotsLeft })}
        </Text>
        <View style={styles.drivers}>
          <Ionicons name="people-outline" size={14} color={colors.textMuted} />
          <Text variant="caption" tone="muted">
            {session.paidCount}/{session.maxDrivers}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  top: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  timeCol: { alignItems: 'flex-start', minWidth: 58 },
  time: { fontSize: 24, lineHeight: 28 },
  speed: { height: 3, width: 28, marginTop: spacing.xs, transform: [{ skewX: '-30deg' }] },
  main: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fillRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fillTrack: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fillBar: { height: '100%' },
  priceCol: { alignItems: 'flex-end', gap: 2 },
  drivers: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
