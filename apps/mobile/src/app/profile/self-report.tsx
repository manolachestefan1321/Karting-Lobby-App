import { parseLapTime } from '@kartup/domain';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, DateField, PickerField, Screen, Text, TextField } from '@/components/ui';
import { useNow } from '@/lib/live';
import { toast } from '@/features/notifications/BannerHost';
import { useCities, useSelfReport, useTracks } from '@/features/profile/api';
import { errorText } from '@/lib/errors';
import { localDateKey } from '@/lib/format';

const digits = (v: string) => v.replace(/[^0-9]/g, '');

/**
 * Self-report a race result. It is UNVERIFIED: shown in the race history, but no
 * km / XP / rank until a KartUP admin approves it.
 */
export default function SelfReportScreen() {
  const { t, i18n } = useTranslation();
  const now = useNow(60_000);
  const tracks = useTracks();
  const cities = useCities();
  const save = useSelfReport();
  const [trackId, setTrackId] = useState<string | null>(null);
  const [date, setDate] = useState(localDateKey(now, 'Europe/Bucharest'));
  const [position, setPosition] = useState('');
  const [fieldSize, setFieldSize] = useState('');
  const [laps, setLaps] = useState('');
  const [lap, setLap] = useState('');
  const [error, setError] = useState<string>();

  const trackItems = useMemo(
    () => (tracks.data ?? []).map((tr) => ({ value: tr.id, label: tr.name, subtitle: cities.data?.find((c) => c.id === tr.cityId)?.name })),
    [tracks.data, cities.data],
  );

  const submit = () => {
    const bestLapMs = lap.trim() ? parseLapTime(lap) : null;
    if (!trackId || !position || !fieldSize || !laps) return setError(t('validation.required'));
    if (lap.trim() && bestLapMs === null) return setError(t('validation.lapTime'));
    save.mutate(
      { trackId, date, position: Number(position), fieldSize: Number(fieldSize), laps: Number(laps), bestLapMs },
      {
        onSuccess: () => {
          toast(t('profile.selfReportSent'));
          router.back();
        },
        onError: (e) => toast(errorText(e, t as never, i18n.language), 'danger'),
      },
    );
  };

  return (
    <Screen footer={<Button title={t('common.save')} onPress={submit} loading={save.isPending} />}>
      <Text variant="title">{t('profile.selfReportTitle')}</Text>
      <Card>
        <Chip label={t('profile.unverified')} tone="warning" />
        <Text tone="muted">{t('profile.selfReportHint')}</Text>
      </Card>
      <PickerField label={t('profile.track')} placeholder={t('profile.selectTrack')} value={trackId} items={trackItems} onChange={setTrackId} />
      <DateField label={t('profile.raceDate')} value={date} onChange={setDate} maximumDate={now} minimumDate={new Date(now.getTime() - 365 * 24 * 3_600_000)} />
      <TextField label={t('profile.finishPosition')} value={position} onChangeText={(v) => setPosition(digits(v))} keyboardType="number-pad" maxLength={2} placeholder="3" />
      <TextField label={t('profile.fieldSize')} value={fieldSize} onChangeText={(v) => setFieldSize(digits(v))} keyboardType="number-pad" maxLength={2} placeholder="8" />
      <TextField label={t('profile.lapsCompleted')} value={laps} onChangeText={(v) => setLaps(digits(v))} keyboardType="number-pad" maxLength={3} placeholder="12" />
      <TextField
        label={`${t('profile.bestLap')} (${t('common.optional')})`}
        value={lap}
        onChangeText={setLap}
        placeholder={t('profile.bestLapPlaceholder')}
        keyboardType="numbers-and-punctuation"
        error={error}
      />
    </Screen>
  );
}
