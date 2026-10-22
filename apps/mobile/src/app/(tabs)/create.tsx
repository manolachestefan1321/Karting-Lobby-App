import { hostPayoutMinor, participantPrice, type ExperienceLevel } from '@kartup/domain';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, EmptyState, LoadingState, PickerField, Screen, SectionHeader, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { toast } from '@/features/notifications/BannerHost';
import { useCities, useRankTiers, useSetupPayouts, useTracks } from '@/features/profile/api';
import { useCreateSession } from '@/features/sessions/hooks';
import { useRulesOrDefault } from '@/features/sessions/rules';
import { errorText } from '@/lib/errors';
import { formatDay, localDateKey, money, relative, zonedToUtc } from '@/lib/format';
import { useNow } from '@/lib/live';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const LEVELS: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const TIMES = Array.from({ length: 27 }, (_, i) => {
  const minutes = 10 * 60 + i * 30; // 10:00 … 23:00
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

export default function CreateTab() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const rules = useRulesOrDefault();
  const now = useNow(30_000);
  const cities = useCities();
  const tiers = useRankTiers();
  const setupPayouts = useSetupPayouts();
  const create = useCreateSession();
  const storedCity = usePreferences((s) => s.cityId);
  const [cityId, setCityId] = useState<string | null>(storedCity ?? profile?.homeCityId ?? null);
  const tracks = useTracks(cityId ?? undefined);
  const [trackId, setTrackId] = useState<string | null>(null);
  const track = tracks.data?.find((x) => x.id === trackId) ?? null;
  const tz = track?.timezone ?? 'Europe/Bucharest';
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [maxDrivers, setMaxDrivers] = useState(8);
  const [minRank, setMinRank] = useState<number | null>(null);
  const [minSkill, setMinSkill] = useState<ExperienceLevel | null>(null);
  const [note, setNote] = useState('');
  const locale = i18n.language;

  const days = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date(now.getTime() + i * 86_400_000);
        return { key: localDateKey(d, tz), label: i === 0 ? t('create.days.today') : i === 1 ? t('create.days.tomorrow') : formatDay(d, tz, locale) };
      }),
    [now.toDateString(), tz, locale], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const earliest = now.getTime() + (rules.autoCancelBeforeMinutes + 60) * 60_000;
  const startsAt = day && time ? zonedToUtc(day, time, tz) : null;
  const maxAllowed = track?.maxDrivers ?? 12;
  const drivers = Math.min(Math.max(maxDrivers, rules.minDrivers), maxAllowed);
  const price = track ? participantPrice(track.price.perDriverMinor, rules.platformFeeMinor, track.price.currency) : null;

  if (!profile) return <LoadingState />;

  // Hosts must verify a payout account (Stripe Connect) before creating sessions.
  if (!profile.payoutsEnabled) {
    return (
      <Screen edges={['top']}>
        <Text variant="title">{t('create.title')}</Text>
        <Card style={styles.gap}>
          <Ionicons name="wallet-outline" size={32} color={colors.accent} />
          <Text variant="heading">{t('create.payoutsTitle')}</Text>
          <Text tone="muted">{t('create.payoutsBody')}</Text>
          <Button title={t('create.payoutsCta')} onPress={() => setupPayouts.mutate(undefined, { onSuccess: () => toast(t('create.payoutsDone')) })} loading={setupPayouts.isPending} />
        </Card>
      </Screen>
    );
  }

  const submit = () => {
    if (!trackId || !startsAt) return;
    create.mutate(
      { trackId, startsAt: startsAt.toISOString(), maxDrivers: drivers, minRankTierId: minRank, minSkill, note },
      {
        onSuccess: (s) => {
          toast(t('create.created'));
          setTrackId(null);
          setDay(null);
          setTime(null);
          setNote('');
          router.push({ pathname: '/session/[id]', params: { id: s.id, pay: '1' } });
        },
        onError: (e) => toast(errorText(e, t as never, locale), 'danger'),
      },
    );
  };

  return (
    <Screen edges={['top']} footer={<Button title={t('create.submit')} onPress={submit} disabled={!trackId || !startsAt} loading={create.isPending} />}>
      <Text variant="title">{t('create.title')}</Text>

      <PickerField
        label={t('create.city')}
        placeholder={t('onboarding.selectCity')}
        value={cityId}
        items={(cities.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        onChange={(v) => {
          setCityId(v);
          setTrackId(null);
        }}
      />
      {tracks.data && tracks.data.length === 0 ? (
        <EmptyState icon="map-outline" title={t('create.noTracks')} />
      ) : (
        <PickerField
          label={t('create.track')}
          placeholder={t('create.selectTrack')}
          value={trackId}
          items={(tracks.data ?? []).map((x) => ({ value: x.id, label: x.name, subtitle: `${money(x.price.perDriverMinor, x.price.currency, locale)}${x.price.verified ? '' : ' (?)'} · ${x.sessionLengthMin} min · ${x.indoor ? t('create.indoor') : t('create.outdoor')} · ${t('create.maxShort', { count: x.maxDrivers })}` }))}
          onChange={(v) => {
            setTrackId(v);
            const tr = tracks.data?.find((x) => x.id === v);
            if (tr) setMaxDrivers(Math.min(tr.maxDrivers, 10));
          }}
        />
      )}

      {track && price ? (
        <Card style={styles.gapSm}>
          <Text>{t('create.priceInfo', { total: money(price.totalMinor, price.currency, locale), track: money(price.trackMinor, price.currency, locale), fee: money(price.feeMinor, price.currency, locale) })}</Text>
          <Text variant="caption" tone="faint">
            {t('create.priceUpdated', { when: relative(track.price.updatedAt, now, locale) })} · {track.sessionLengthMin} min · {track.kartTypes.join(', ')}
          </Text>
          {!track.price.verified ? <Chip label={t('lobby.priceToVerify')} tone="warning" icon="alert-circle-outline" /> : null}
          {track.price.note ? (
            <Text variant="caption" tone="muted">
              {track.price.note}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <SectionHeader title={t('create.date')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {days.map((d) => (
          <Chip key={d.key} label={d.label} selected={day === d.key} onPress={() => setDay(d.key)} />
        ))}
      </ScrollView>

      <SectionHeader title={t('create.time')} />
      <Text variant="caption" tone="muted">
        {t('create.timeHint', { tz })}
      </Text>
      <View style={styles.wrapChips}>
        {TIMES.map((tm) => {
          const tooSoon = !day || zonedToUtc(day, tm, tz).getTime() < earliest;
          return (
            <Pressable
              key={tm}
              disabled={tooSoon}
              onPress={() => setTime(tm)}
              accessibilityRole="button"
              accessibilityState={{ selected: time === tm, disabled: tooSoon }}
              style={[styles.time, { borderColor: time === tm ? colors.accent : colors.border, backgroundColor: time === tm ? colors.accent : colors.surface, opacity: tooSoon ? 0.35 : 1 }]}
            >
              <Text variant="small" style={{ color: time === tm ? colors.onAccent : colors.text, fontWeight: '600' }}>
                {tm}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader title={t('create.maxDrivers')} />
      <View style={styles.stepper}>
        <Button title="−" variant="secondary" size="md" fullWidth={false} onPress={() => setMaxDrivers(Math.max(rules.minDrivers, drivers - 1))} accessibilityLabel="-" />
        <Text variant="title" style={styles.stepValue}>
          {drivers}
        </Text>
        <Button title="+" variant="secondary" size="md" fullWidth={false} onPress={() => setMaxDrivers(Math.min(maxAllowed, drivers + 1))} accessibilityLabel="+" />
        <Text variant="caption" tone="muted" style={styles.flex}>
          {t('create.maxDriversHint', { min: rules.minDrivers, max: maxAllowed })}
        </Text>
      </View>

      <SectionHeader title={t('create.minRank')} />
      <View style={styles.wrapChips}>
        <Chip label={t('create.anyRank')} selected={minRank === null} onPress={() => setMinRank(null)} />
        {(tiers.data ?? []).slice(1).map((tier) => (
          <Chip key={tier.id} label={tier.name} selected={minRank === tier.id} onPress={() => setMinRank(tier.id)} />
        ))}
      </View>

      <SectionHeader title={t('create.minSkill')} />
      <View style={styles.wrapChips}>
        <Chip label={t('create.anyLevel')} selected={minSkill === null} onPress={() => setMinSkill(null)} />
        {LEVELS.slice(1).map((l) => (
          <Chip key={l} label={t(`profile.level.${l}`)} selected={minSkill === l} onPress={() => setMinSkill(l)} />
        ))}
      </View>

      <TextField label={`${t('create.note')} (${t('common.optional')})`} value={note} onChangeText={setNote} placeholder={t('create.notePlaceholder')} multiline maxLength={300} />

      {price ? (
        <Card style={[styles.gapSm, { borderColor: colors.accent, borderWidth: 1 }]}>
          <Text variant="small">{t('create.hostInfo', { amount: money(hostPayoutMinor(price.trackMinor, ['confirmed']), price.currency, locale) })}</Text>
          <Text variant="small" tone="muted">
            {t('create.minDriversHint', { min: rules.minDrivers, hours: Math.round(rules.autoCancelBeforeMinutes / 60) })}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md, alignItems: 'flex-start' },
  gapSm: { gap: spacing.sm },
  chips: { gap: spacing.xs, paddingRight: spacing.lg },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  time: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, minWidth: 58, alignItems: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepValue: { minWidth: 36, textAlign: 'center' },
  flex: { flex: 1 },
});
