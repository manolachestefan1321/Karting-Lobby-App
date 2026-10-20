import { EXPERIENCE_LEVELS, formatLapTime, parseLapTime, type ExperienceLevel } from '@kartapp/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, LoadingState, PickerField, Screen, SegmentedControl, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCities, useDeleteExperience, useTrackExperience, useTracks, useUpsertExperience } from '@/features/profile/api';
import { errorKey } from '@/lib/errors';
import { spacing } from '@/theme/tokens';

/** Add or edit karting experience for one track. Opened with ?trackId= to edit. */
export default function ExperienceEditor() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session!.user.id;
  const params = useLocalSearchParams<{ trackId?: string }>();
  const tracks = useTracks();
  const cities = useCities();
  const existing = useTrackExperience(userId);
  const upsert = useUpsertExperience(userId);
  const remove = useDeleteExperience(userId);

  const [trackId, setTrackId] = useState<string | null>(params.trackId ?? null);
  const [level, setLevel] = useState<ExperienceLevel>('beginner');
  const [lap, setLap] = useState('');
  const [sessions, setSessions] = useState('0');
  const [lapError, setLapError] = useState<string>();
  const [trackError, setTrackError] = useState<string>();

  const current = existing.data?.find((e) => e.track_id === trackId);
  useEffect(() => {
    if (current) {
      setLevel(current.level);
      setLap(current.best_lap_ms ? formatLapTime(current.best_lap_ms) : '');
      setSessions(String(current.sessions_count));
    }
  }, [current]);

  const trackItems = useMemo(
    () =>
      (tracks.data ?? []).map((tr) => ({
        value: tr.id,
        label: tr.name,
        subtitle: cities.data?.find((c) => c.id === tr.city_id)?.name,
      })),
    [tracks.data, cities.data],
  );

  if (tracks.isPending || existing.isPending) return <LoadingState />;
  if (!tracks.data?.length) {
    return (
      <Screen scroll={false}>
        <EmptyState icon="map-outline" title={t('profile.noTracks')} />
      </Screen>
    );
  }

  const save = () => {
    if (!trackId) return setTrackError(t('validation.required'));
    const bestLapMs = lap.trim() ? parseLapTime(lap) : null;
    if (lap.trim() && bestLapMs === null) return setLapError(t('validation.lapTime'));
    const count = Math.max(0, Math.min(10000, parseInt(sessions, 10) || 0));
    upsert.mutate(
      { trackId, level, bestLapMs, sessionsCount: count },
      {
        onSuccess: () => router.back(),
        onError: (e) => Alert.alert(t('common.errorTitle'), t(errorKey(e) as 'errors.generic')),
      },
    );
  };

  return (
    <Screen
      footer={
        <>
          <Button title={t('common.save')} onPress={save} loading={upsert.isPending} />
          {current ? (
            <Button
              title={t('profile.removeExperience')}
              variant="danger"
              loading={remove.isPending}
              onPress={() => remove.mutate(current.track_id, { onSuccess: () => router.back() })}
            />
          ) : null}
        </>
      }
    >
      <Text variant="title">{t('profile.editExperience')}</Text>
      <PickerField
        label={t('profile.track')}
        placeholder={t('profile.selectTrack')}
        value={trackId}
        items={trackItems}
        onChange={(v) => {
          setTrackId(v);
          setTrackError(undefined);
        }}
        error={trackError}
      />
      <View style={styles.gap}>
        <Text variant="label" tone="muted">
          {t('profile.experienceLevel')}
        </Text>
        <SegmentedControl
          value={level}
          onChange={setLevel}
          accessibilityLabel={t('profile.experienceLevel')}
          options={EXPERIENCE_LEVELS.map((l) => ({ value: l, label: t(`profile.level.${l}`) }))}
        />
      </View>
      <TextField
        label={`${t('profile.bestLap')} (${t('common.optional')})`}
        value={lap}
        onChangeText={(v) => {
          setLap(v);
          setLapError(undefined);
        }}
        placeholder={t('profile.bestLapPlaceholder')}
        keyboardType="numbers-and-punctuation"
        error={lapError}
      />
      <TextField
        label={t('profile.sessionsCount')}
        value={sessions}
        onChangeText={(v) => setSessions(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={5}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ gap: { gap: spacing.xs } });
