import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, EmptyState, LoadingState, Screen, SegmentedControl, Text } from '@/components/ui';
import { api, type PartnerDeskSession, type Track } from '@/data';
import { toast } from '@/features/notifications/BannerHost';
import { useTracks } from '@/features/profile/api';
import { saveCsv } from '@/lib/csv';
import { errorText } from '@/lib/errors';
import { formatDay, formatTime, money, monthLabel, nextDays, recentMonthKeys, zonedToUtc } from '@/lib/format';
import { useLiveQuery, useNow } from '@/lib/live';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const DAY_MS = 86_400_000;

/**
 * Track partner panel, for the desk at a track like VMax (and for the founder):
 *  - Desk: the day's sessions with every driver's booking code; mark who arrived.
 *  - Stats: what KartUP brought the track in a month, and the list for invoicing.
 * The server only shows a track to its own staff.
 */
export default function PartnerPanel() {
  const { t } = useTranslation();
  const mine = useQuery({ queryKey: ['partner_tracks'], queryFn: () => api.partner.myTracks() });
  const tracks = useTracks();
  const [trackId, setTrackId] = useState<string | null>(null);
  const [tab, setTab] = useState<'desk' | 'stats'>('desk');

  if (mine.isPending || tracks.isPending) return <LoadingState />;
  const list = (tracks.data ?? []).filter((x) => mine.data?.includes(x.id));
  if (!list.length) return <EmptyState icon="lock-closed-outline" title={t('partner.noAccess')} />;
  const track = list.find((x) => x.id === trackId) ?? list[0]!;

  return (
    <Screen maxWidth={900}>
      <Text variant="title">{t('partner.title')}</Text>
      {list.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.pills}>
          {list.map((x) => (
            <Pill key={x.id} label={x.name} on={x.id === track.id} onPress={() => setTrackId(x.id)} />
          ))}
        </ScrollView>
      ) : (
        <Text variant="heading">{track.name}</Text>
      )}
      <SegmentedControl
        value={tab}
        onChange={(v) => setTab(v as 'desk' | 'stats')}
        options={[
          { value: 'desk', label: t('partner.desk') },
          { value: 'stats', label: t('partner.stats') },
        ]}
      />
      {tab === 'desk' ? <Desk track={track} /> : <Stats track={track} />}
    </Screen>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.pill, { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accent : colors.surface }]}
    >
      <Text variant="label" style={{ color: on ? colors.onAccent : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The desk: pick a day, find a driver by code or name, mark arrivals. */
function Desk({ track }: { track: Track }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const now = useNow(30_000);
  const tz = track.timezone;
  const days = useMemo(() => nextDays(now, tz, 7), [now.toDateString(), tz]); // eslint-disable-line react-hooks/exhaustive-deps
  const [dayKey, setDayKey] = useState(days[0]!.key);
  const [query, setQuery] = useState('');
  const from = zonedToUtc(dayKey, '00:00', tz);
  const to = new Date(from.getTime() + DAY_MS + 2 * 3_600_000); // DST-safe: a little past midnight, then filter by local day
  const desk = useLiveQuery('sessions', {
    queryKey: ['partner_desk', track.id, dayKey],
    queryFn: () => api.partner.desk(track.id, from.toISOString(), to.toISOString()),
  });
  const arrive = useMutation({
    mutationFn: ({ sessionId, userId, arrived }: { sessionId: string; userId: string; arrived: boolean }) => api.partner.markArrived(sessionId, userId, arrived),
    onSettled: () => qc.invalidateQueries({ queryKey: ['partner_desk'] }),
  });

  const sameDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso)) === dayKey;
  const q = query.trim().toLowerCase().replace(/^kup-?/, '');
  const match = (name: string, code: string | null) => !q || name.toLowerCase().includes(q) || (code ?? '').toLowerCase().replace('kup-', '').includes(q);
  const sessions = (desk.data ?? []).filter((s) => sameDay(s.startsAt));
  const shown = sessions.map((s) => ({ ...s, drivers: s.drivers.filter((d) => match(d.name, d.code)) })).filter((s) => !q || s.drivers.length > 0);
  const canMark = (s: PartnerDeskSession) => !s.cancelled && now.getTime() >= new Date(s.startsAt).getTime() - 2 * 3_600_000 && now.getTime() <= new Date(s.startsAt).getTime() + 6 * 3_600_000;

  return (
    <View style={styles.gap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.pills}>
        {days.map(({ key, noon }, i) => (
          <Pill key={key} label={i === 0 ? t('create.days.today') : i === 1 ? t('create.days.tomorrow') : formatDay(noon, tz, i18n.language)} on={key === dayKey} onPress={() => setDayKey(key)} />
        ))}
      </ScrollView>
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('partner.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[styles.searchInput, { color: colors.text }]}
          accessibilityLabel={t('partner.searchPlaceholder')}
        />
      </View>

      {desk.isPending ? (
        <LoadingState />
      ) : shown.length === 0 ? (
        <Card>
          <Text tone="muted">{q ? t('partner.noMatch') : t('partner.noSessions')}</Text>
        </Card>
      ) : (
        shown.map((s) => {
          const arrived = s.drivers.filter((d) => d.arrivedAt).length;
          const total = sessions.find((x) => x.sessionId === s.sessionId)?.drivers.length ?? s.drivers.length;
          return (
            <Card key={s.sessionId} padded={false}>
              <View style={[styles.sessionHead, { borderBottomColor: colors.border }]}>
                <Text variant="heading">{formatTime(s.startsAt, tz, i18n.language)}</Text>
                <View style={styles.flex}>
                  <Text variant="small" tone="muted" numberOfLines={1}>
                    {t('partner.host', { name: s.host })}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {t('partner.seats', { taken: total, max: s.maxDrivers })} · {t('partner.arrivedCount', { n: arrived, total })}
                  </Text>
                </View>
                {s.cancelled ? <Chip label={t('partner.cancelled')} tone="danger" /> : null}
                {s.official ? <Chip label={t('sessions.official')} tone="accent" icon="trophy" /> : null}
              </View>
              {s.drivers.length === 0 ? (
                <Text tone="muted" style={styles.empty}>
                  {t('partner.noDrivers')}
                </Text>
              ) : (
                s.drivers.map((d) => (
                  <View key={d.userId} style={[styles.driver, { borderBottomColor: colors.border }]}>
                    <View style={styles.flex}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {d.name}
                      </Text>
                      <Text style={[styles.code, { color: colors.text }]} selectable>
                        {d.code ?? '—'}
                      </Text>
                    </View>
                    {d.arrivedAt ? <Chip label={t('partner.arrived')} tone="success" icon="checkmark" /> : null}
                    {canMark(s) ? (
                      <Button
                        title={d.arrivedAt ? t('partner.undo') : t('partner.markArrived')}
                        variant={d.arrivedAt ? 'ghost' : 'primary'}
                        size="md"
                        fullWidth={false}
                        loading={arrive.isPending && arrive.variables?.userId === d.userId && arrive.variables?.sessionId === s.sessionId}
                        onPress={() =>
                          arrive.mutate(
                            { sessionId: s.sessionId, userId: d.userId, arrived: !d.arrivedAt },
                            { onError: (e) => toast(errorText(e, t as never, i18n.language), 'danger') },
                          )
                        }
                      />
                    ) : null}
                  </View>
                ))
              )}
            </Card>
          );
        })
      )}
    </View>
  );
}

/** What KartUP brought the track in a month, and the list with codes for invoicing. */
function Stats({ track }: { track: Track }) {
  const { t, i18n } = useTranslation();
  const months = recentMonthKeys(track.timezone);
  const [month, setMonth] = useState(months[0]!);
  const stats = useLiveQuery('sessions', { queryKey: ['partner_stats', track.id, month], queryFn: () => api.partner.stats(track.id, month) });
  const n = (v: number) => v.toLocaleString(i18n.language);
  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

  const exportCsv = async () => {
    const rows = await api.partner.report(track.id, month);
    const fmt = new Intl.DateTimeFormat('ro-RO', { timeZone: track.timezone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    await saveCsv(`KartUP-${track.name.replace(/\s+/g, '-')}-${month}.csv`, [
      [t('analytics.csv.track'), t('analytics.csv.date'), t('analytics.csv.driver'), t('analytics.csv.code'), t('partner.csvArrived')],
      ...rows.map((r) => [track.name, fmt.format(new Date(r.startsAt)), r.driver, r.code ?? '', r.arrivedAt ? t('common.yes') : t('common.no')]),
      [],
      [t('analytics.csv.total'), '', String(rows.length), '', ''],
    ]);
  };

  const s = stats.data;
  return (
    <View style={styles.gap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.pills}>
        {months.map((m) => (
          <Pill key={m} label={monthLabel(m, i18n.language)} on={m === month} onPress={() => setMonth(m)} />
        ))}
      </ScrollView>
      {stats.isPending || !s ? (
        <LoadingState />
      ) : (
        <>
          <View style={styles.grid}>
            <Tile label={t('partner.kpi.drivers')} value={n(s.drivers)} note={t('partner.kpi.driversNote', { sessions: s.sessions, unique: s.uniqueDrivers })} />
            <Tile label={t('partner.kpi.newCustomers')} value={n(s.newCustomers)} note={t('partner.kpi.newCustomersNote')} />
            <Tile label={t('partner.kpi.revenue')} value={money(s.revenueMinor, s.currency, i18n.language)} note={t('partner.kpi.revenueNote')} />
            <Tile label={t('partner.kpi.offPeak')} value={n(s.offPeakDrivers)} note={t('partner.kpi.offPeakNote', { pct: pct(s.offPeakDrivers, s.drivers) })} />
            <Tile label={t('partner.kpi.arrived')} value={`${pct(s.arrived, s.drivers)}%`} note={t('partner.kpi.arrivedNote', { n: s.arrived, total: s.drivers })} />
            <Tile label={t('partner.kpi.upcoming')} value={n(s.upcomingDrivers)} note={t('partner.kpi.upcomingNote', { count: s.upcomingSessions })} />
          </View>
          <Button title={t('partner.exportCsv')} variant="secondary" onPress={() => void exportCsv()} />
          <Text variant="caption" tone="muted">
            {t('partner.statsHint')}
          </Text>
        </>
      )}
    </View>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <Card style={styles.tile}>
      <Text variant="caption" tone="muted" style={styles.upper}>
        {label}
      </Text>
      <Text variant="stat" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="caption" tone="muted">
        {note}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
  noGrow: { flexGrow: 0 },
  pills: { gap: spacing.xs, alignItems: 'center' },
  pill: { alignSelf: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, minHeight: 44, fontSize: 16 },
  sessionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, flexWrap: 'wrap' },
  driver: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  code: { fontFamily: 'monospace', fontSize: 15, letterSpacing: 1 },
  empty: { padding: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { flexGrow: 1, flexBasis: 160, gap: 4 },
  upper: { textTransform: 'uppercase', letterSpacing: 1 },
  flex: { flex: 1, gap: 2 },
});
