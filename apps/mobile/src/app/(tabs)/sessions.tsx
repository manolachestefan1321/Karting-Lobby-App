import type { ExperienceLevel } from '@kartup/domain';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Wordmark } from '@/components/brand/Wordmark';
import { Button, Chip, EmptyState, ErrorState, LoadingState, PickerField, Screen, SectionHeader, Text } from '@/components/ui';
import type { KartSession, SessionFilters } from '@/data';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCities, useRankTiers, useTracks } from '@/features/profile/api';
import { phaseOf, SessionCard } from '@/features/sessions/components';
import { useMySessions, useSessions } from '@/features/sessions/hooks';
import { formatDay, localDateKey, nextDays } from '@/lib/format';
import { useNow } from '@/lib/live';
import { usePreferences } from '@/store/preferences';
import { spacing } from '@/theme/tokens';

const LEVELS: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const SPOTS = [0, 1, 2, 4];

export default function SessionsTab() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const now = useNow(15_000);
  const cities = useCities();
  const tiers = useRankTiers();
  const storedCity = usePreferences((s) => s.cityId);
  const setCityId = usePreferences((s) => s.setCityId);
  const cityId = storedCity ?? profile?.homeCityId ?? cities.data?.[0]?.id ?? null;
  const city = cities.data?.find((c) => c.id === cityId);
  const tz = city?.timezone ?? 'Europe/Bucharest';
  const tracks = useTracks(cityId ?? undefined);

  const [date, setDate] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [skill, setSkill] = useState<ExperienceLevel | null>(null);
  const [minSpots, setMinSpots] = useState(0);
  const filtered = !!(date || trackId || skill || minSpots);

  const filters: SessionFilters | null = cityId ? { cityId, date, trackId, skill, minSpotsLeft: minSpots } : null;
  const sessions = useSessions(filters);
  const mine = useMySessions();

  // Next 7 days as date chips (in the city's time zone).
  const days = useMemo(() => {
    return nextDays(now, tz, 7).map(({ key, noon }, i) => ({
      key,
      label: i === 0 ? t('sessions.today') : i === 1 ? t('sessions.tomorrow') : formatDay(noon, tz, i18n.language),
    }));
  }, [now.toDateString(), tz, i18n.language]); // eslint-disable-line react-hooks/exhaustive-deps

  // "My sessions": upcoming seats + anything that still needs my action.
  const myActive = (mine.data ?? [])
    .filter((s) => {
      const phase = phaseOf(s, now);
      if (phase === 'cancelled' || phase === 'final') return false;
      return s.myStatus !== 'cancelled' && s.myStatus !== 'removed';
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const sections = useMemo(() => {
    const groups = new Map<string, KartSession[]>();
    for (const s of sessions.data ?? []) {
      const k = localDateKey(s.startsAt, tz);
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    return [...groups.entries()];
  }, [sessions.data, tz]);

  const dayLabel = (key: string) => days.find((d) => d.key === key)?.label ?? formatDay(`${key}T12:00:00Z`, tz, i18n.language);

  return (
    <Screen edges={['top']} refreshing={sessions.isRefetching} onRefresh={() => void sessions.refetch()}>
      <View style={styles.header}>
        <Wordmark size={30} slogan={false} />
        <View style={styles.flex} />
      </View>

      <PickerField
        label={t('sessions.city')}
        placeholder={t('onboarding.selectCity')}
        value={cityId}
        items={(cities.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        onChange={(v) => {
          setCityId(v);
          setTrackId(null);
        }}
      />

      {myActive.length > 0 ? (
        <View style={styles.gap}>
          <SectionHeader title={t('sessions.mine')} />
          {myActive.map((s) => (
            <SessionCard key={s.id} session={s} now={now} tiers={tiers.data} showDate />
          ))}
        </View>
      ) : null}

      <View style={styles.gap}>
        <SectionHeader title={t('sessions.filters')} right={filtered ? <Text tone="accent" variant="small" onPress={() => { setDate(null); setTrackId(null); setSkill(null); setMinSpots(0); }}>{t('sessions.clearFilters')}</Text> : undefined} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={t('sessions.anyDate')} selected={!date} onPress={() => setDate(null)} />
          {days.map((d) => (
            <Chip key={d.key} label={d.label} selected={date === d.key} onPress={() => setDate(d.key)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={t('sessions.allTracks')} selected={!trackId} onPress={() => setTrackId(null)} icon="map-outline" />
          {(tracks.data ?? []).map((tr) => (
            <Chip key={tr.id} label={tr.name} selected={trackId === tr.id} onPress={() => setTrackId(tr.id)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label={t('sessions.anyLevel')} selected={!skill} onPress={() => setSkill(null)} icon="speedometer-outline" />
          {LEVELS.map((l) => (
            <Chip key={l} label={t(`profile.level.${l}`)} selected={skill === l} onPress={() => setSkill(l)} />
          ))}
          <View style={styles.divider} />
          {SPOTS.map((n) => (
            <Chip key={n} label={n === 0 ? `${t('sessions.spots')}: ${t('sessions.spotsAny')}` : t('sessions.spotsMin', { count: n })} selected={minSpots === n} onPress={() => setMinSpots(n)} icon={n === 0 ? 'people-outline' : undefined} />
          ))}
        </ScrollView>
      </View>

      {sessions.isPending ? (
        <LoadingState />
      ) : sessions.isError ? (
        <ErrorState onRetry={() => void sessions.refetch()} />
      ) : sections.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          title={t('sessions.emptyTitle')}
          body={filtered ? t('sessions.emptyFilteredBody') : t('sessions.emptyBody', { city: city?.name ?? '' })}
          actionLabel={t('sessions.createCta')}
          onAction={() => router.push('/create')}
        />
      ) : (
        sections.map(([day, list]) => (
          <View key={day} style={styles.gap}>
            <SectionHeader title={dayLabel(day)} />
            {list.map((s) => (
              <SessionCard key={s.id} session={s} now={now} tiers={tiers.data} />
            ))}
          </View>
        ))
      )}
      <Text variant="caption" tone="faint" align="center">
        {t('sessions.trackTime')}
      </Text>
      {sections.length > 0 ? <Button title={t('sessions.createCta')} variant="secondary" onPress={() => router.push('/create')} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  gap: { gap: spacing.sm },
  chips: { gap: spacing.xs, paddingRight: spacing.lg, alignItems: 'center' },
  divider: { width: spacing.sm },
});
