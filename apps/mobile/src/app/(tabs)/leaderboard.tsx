import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar, Card, Chip, EmptyState, ErrorState, LoadingState, Screen, SegmentedControl, Text } from '@/components/ui';
import type { LeaderboardEntry, LeaderboardScope, RankTier } from '@/data';
import { useAuth, useMyId } from '@/features/auth/AuthProvider';
import { useCities, useRankTiers, useTracks } from '@/features/profile/api';
import { RankBadge } from '@/features/profile/ProfileView';
import { useLeaderboard, useSeasons } from '@/features/ranking/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

type Kind = LeaderboardScope['kind'];

export default function LeaderboardTab() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const myId = useMyId();
  const [kind, setKind] = useState<Kind>('global');
  const cities = useCities();
  const [cityId, setCityId] = useState<string | null>(profile?.homeCityId ?? null);
  const tracks = useTracks();
  const [trackId, setTrackId] = useState<string | null>(null);
  const seasons = useSeasons();
  const [season, setSeason] = useState<string | null>(null);
  const tiers = useRankTiers();

  useEffect(() => {
    if (!trackId && tracks.data?.[0]) setTrackId(tracks.data[0].id);
  }, [tracks.data, trackId]);
  useEffect(() => {
    if (!season && seasons.data?.[0]) setSeason(seasons.data[0]);
  }, [seasons.data, season]);

  const scope: LeaderboardScope =
    kind === 'city' ? { kind, cityId: cityId ?? '' } : kind === 'track' ? { kind, trackId: trackId ?? '' } : kind === 'season' ? { kind, season: season ?? '' } : { kind: 'global' };
  const board = useLeaderboard(scope);
  const monthLabel = (s: string) => new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(new Date(`${s}-15T12:00:00Z`));
  const mine = board.data?.find((e) => e.user.id === myId);

  return (
    <Screen edges={['top']} refreshing={board.isRefetching} onRefresh={() => void board.refetch()}>
      <View style={styles.titleRow}>
        <Text variant="title" style={styles.flex}>
          {t('leaderboard.title')}
        </Text>
        <View style={styles.live}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text variant="caption" tone="muted">
            {t('leaderboard.live')}
          </Text>
        </View>
      </View>
      <SegmentedControl<Kind>
        value={kind}
        onChange={setKind}
        accessibilityLabel={t('leaderboard.title')}
        options={[
          { value: 'global', label: t('leaderboard.global') },
          { value: 'city', label: t('leaderboard.city') },
          { value: 'track', label: t('leaderboard.track') },
          { value: 'season', label: t('leaderboard.season') },
        ]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {kind === 'city' && (cities.data ?? []).map((c) => <Chip key={c.id} label={c.name} selected={cityId === c.id} onPress={() => setCityId(c.id)} />)}
        {kind === 'track' && (tracks.data ?? []).map((x) => <Chip key={x.id} label={x.name} selected={trackId === x.id} onPress={() => setTrackId(x.id)} />)}
        {kind === 'season' && (seasons.data ?? []).map((s) => <Chip key={s} label={monthLabel(s)} selected={season === s} onPress={() => setSeason(s)} />)}
      </ScrollView>
      <Text variant="caption" tone="muted">
        {kind === 'season' ? t('leaderboard.seasonHint') : t('leaderboard.allTimeHint')}
      </Text>

      {mine ? (
        <Card style={[styles.mine, { borderColor: colors.accent }]}>
          <Text variant="label" tone="muted">
            {t('leaderboard.you')}
          </Text>
          <Text variant="title">#{mine.position}</Text>
          <Text variant="heading" tone="accent">
            {mine.xp.toLocaleString(i18n.language)} XP
          </Text>
        </Card>
      ) : null}

      {board.isPending ? (
        <LoadingState />
      ) : board.isError ? (
        <ErrorState onRetry={() => void board.refetch()} />
      ) : !board.data?.length ? (
        <EmptyState icon="podium-outline" title={t('leaderboard.empty')} />
      ) : (
        <Card padded={false}>
          {board.data.slice(0, 50).map((e) => (
            <Row key={e.user.id} e={e} me={e.user.id === myId} tier={tiers.data?.find((x) => x.id === e.user.rankTierId)} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

function Row({ e, me, tier }: { e: LeaderboardEntry; me: boolean; tier?: RankTier }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const name = `${e.user.firstName} ${e.user.lastName}`;
  const medal = e.position === 1 ? '#E5A000' : e.position === 2 ? '#A7A9AC' : e.position === 3 ? '#B87333' : undefined;
  return (
    <Pressable
      onPress={() => router.push(me ? '/profile' : `/user/${e.user.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${e.position}. ${name}, ${e.xp} XP`}
      style={({ pressed }) => [styles.row, me && { backgroundColor: colors.surfaceAlt }, pressed && { opacity: 0.8 }]}
    >
      <Text variant="title" style={[styles.pos, medal ? { color: medal } : null]}>
        {e.position}
      </Text>
      <Avatar uri={e.user.avatarUrl} name={name} size={38} ringColor={tier?.color} />
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {name}
          {me ? ` (${t('leaderboard.you')})` : ''}
        </Text>
        <View style={styles.meta}>
          {tier ? <RankBadge tier={tier} small /> : null}
          <Text variant="caption" tone="muted">
            {Math.round(e.km)} km · {e.sessions} {t('leaderboard.sessions')} · {e.wins} {t('leaderboard.wins')}
          </Text>
        </View>
      </View>
      <View style={styles.xp}>
        <Text variant="heading">{e.xp.toLocaleString()}</Text>
        <Text variant="caption" tone="muted">
          {t('leaderboard.xp')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chips: { gap: spacing.xs, paddingRight: spacing.lg },
  mine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pos: { width: 30, textAlign: 'center', fontStyle: 'italic' },
  xp: { alignItems: 'flex-end' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
});
