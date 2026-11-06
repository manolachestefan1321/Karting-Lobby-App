import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, EmptyState, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { ANALYTICS_RANGES, api, type AnalyticsCount, type AnalyticsRange, type AnalyticsReport } from '@/data';
import { useAuth } from '@/features/auth/AuthProvider';
import { money } from '@/lib/format';
import { useNow } from '@/lib/live';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/tokens';

const RANGES: AnalyticsRange[] = ['1h', '8h', '24h', '2d', '7d', '30d', '1y'];
const REFRESH_MS = 10_000;
const TZ = 'Europe/Bucharest';

/**
 * Owner analytics (Profile → Analytics), founder only: website visitors, live users,
 * waitlist, accounts, revenue and karting sessions, for a chosen time range.
 * Refreshes every 10 seconds.
 */
export default function AnalyticsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [range, setRange] = useState<AnalyticsRange>('24h');
  const now = useNow(1000);
  const isAdmin = profile?.role === 'admin';
  const report = useQuery({
    queryKey: ['analytics', range],
    queryFn: () => api.analytics.report(range),
    enabled: isAdmin,
    refetchInterval: REFRESH_MS,
    placeholderData: (prev) => prev,
  });

  if (!isAdmin) return <EmptyState icon="lock-closed-outline" title={t('errors.admin_only')} />;
  if (report.isPending) return <LoadingState />;
  if (report.isError || !report.data) return <ErrorState onRetry={() => void report.refetch()} />;
  const r = report.data;
  const n = (v: number) => v.toLocaleString(i18n.language);
  const ago = Math.max(0, Math.round((now.getTime() - report.dataUpdatedAt) / 1000));

  return (
    <Screen maxWidth={1100}>
      <View style={styles.titleRow}>
        <Text variant="title">{t('analytics.title')}</Text>
        <View style={[styles.live, { borderColor: colors.border }]} accessibilityLabel={t('analytics.updated', { s: ago })}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text variant="caption" tone="muted">
            {t('analytics.live')} · {t('analytics.updated', { s: ago })}
          </Text>
        </View>
      </View>

      {/* Time range (one row, above everything it filters) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rangesScroll} contentContainerStyle={styles.ranges}>
        {RANGES.map((key) => {
          const on = key === range;
          return (
            <Pressable
              key={key}
              onPress={() => setRange(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.range, { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accent : colors.surface }]}
            >
              <Text variant="label" style={{ color: on ? colors.onAccent : colors.text }}>
                {t(`analytics.ranges.${key}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Headline numbers */}
      <View style={styles.grid}>
        <Kpi label={t('analytics.visitors')} value={n(r.visitors)} cur={r.visitors} prev={r.visitorsPrev} />
        <Kpi label={t('analytics.onlineNow')} value={n(r.onlineNow)} note={t('analytics.onlineHint')} liveDot />
        <Kpi label={t('analytics.sessions')} value={n(r.sessions)} cur={r.sessions} prev={r.sessionsPrev} />
        <Kpi label={t('analytics.pageviews')} value={n(r.pageviews)} cur={r.pageviews} prev={r.pageviewsPrev} />
        <Kpi label={t('analytics.avgSession')} value={duration(r.avgSessionSecs)} note={t('analytics.bounce', { pct: r.bounceRate })} />
        <Kpi label={t('analytics.waitlist')} value={n(r.waitlist)} cur={r.waitlist} prev={r.waitlistPrev} note={t('analytics.total', { n: n(r.waitlistTotal) })} />
        <Kpi label={t('analytics.accounts')} value={n(r.accounts)} cur={r.accounts} prev={r.accountsPrev} note={t('analytics.total', { n: n(r.accountsTotal) })} />
        {r.revenue ? (
          <>
            <Kpi
              label={t('analytics.revenue')}
              value={money(r.revenue.grossMinor, r.revenue.currency, i18n.language)}
              cur={r.revenue.grossMinor}
              prev={r.revenue.grossPrevMinor}
              note={t('analytics.payments', { count: r.revenue.payments })}
            />
            <Kpi label={t('analytics.earnings')} value={money(r.revenue.feesMinor, r.revenue.currency, i18n.language)} note={t('analytics.earningsHint')} />
          </>
        ) : (
          <Kpi label={t('analytics.revenue')} value="—" note={t('analytics.notLive')} />
        )}
        {r.karting ? (
          <Kpi label={t('analytics.karting')} value={n(r.karting.active)} note={t('analytics.kartingHint', { live: r.karting.liveNow, raced: r.karting.raced })} />
        ) : (
          <Kpi label={t('analytics.karting')} value="—" note={t('analytics.notLive')} />
        )}
      </View>

      <VisitorsChart report={r} />

      <View style={styles.grid}>
        <Breakdown title={t('analytics.topPages')} rows={r.topPages} />
        <Breakdown title={t('analytics.sources')} rows={r.sources} />
        <Breakdown title={t('analytics.devices')} rows={r.devices.map((d) => ({ ...d, label: t(`analytics.device.${d.label}` as 'analytics.device.mobile') }))} />
      </View>

      <Text variant="caption" tone="muted">
        {api.kind === 'mock' ? t('analytics.demoNote') : t('analytics.realNote')}
      </Text>
    </Screen>
  );
}

function duration(secs: number) {
  const m = Math.floor(secs / 60);
  return `${m}:${String(Math.round(secs % 60)).padStart(2, '0')}`;
}

/** Headline number with the change against the previous period of the same length. */
function Kpi({ label, value, cur, prev, note, liveDot }: { label: string; value: string; cur?: number; prev?: number; note?: string; liveDot?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  let delta: { text: string; up: boolean | null } | null = null;
  if (cur !== undefined && prev !== undefined) {
    if (prev === 0) delta = { text: cur > 0 ? t('analytics.new') : t('analytics.flat'), up: cur > 0 ? true : null };
    else {
      const pct = Math.round(((cur - prev) / prev) * 100);
      delta = { text: t('analytics.vsPrev', { pct: `${pct > 0 ? '+' : ''}${pct}%` }), up: pct === 0 ? null : pct > 0 };
    }
  }
  const deltaColor = delta?.up === true ? colors.success : delta?.up === false ? colors.dangerText : colors.textMuted;
  return (
    <Card style={styles.kpi}>
      <View style={styles.kpiHead}>
        {liveDot ? <View style={[styles.dot, { backgroundColor: colors.success }]} /> : null}
        <Text variant="caption" tone="muted" style={styles.upper}>
          {label}
        </Text>
      </View>
      <Text variant="stat" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {delta ? (
        <View style={styles.deltaRow}>
          {delta.up !== null ? <Ionicons name={delta.up ? 'arrow-up' : 'arrow-down'} size={12} color={deltaColor} /> : null}
          <Text variant="caption" style={{ color: deltaColor }}>
            {delta.text}
          </Text>
        </View>
      ) : null}
      {note ? (
        <Text variant="caption" tone="muted">
          {note}
        </Text>
      ) : null}
    </Card>
  );
}

/** Visitors per time slice: one series, thin bars, tooltip on hover (web) or tap (phone). */
function VisitorsChart({ report }: { report: AnalyticsReport }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [active, setActive] = useState<number | null>(null);
  const { seconds, buckets } = ANALYTICS_RANGES[report.range];
  const step = (seconds * 1000) / buckets;
  const from = new Date(report.from).getTime();
  const max = Math.max(1, ...report.series.map((s) => s.visitors));
  const top = niceCeil(max);
  const short = seconds <= 2 * 86400;
  const label = (i: number) => {
    const d = new Date(from + i * step);
    const opts: Intl.DateTimeFormatOptions = short
      ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }
      : seconds <= 30 * 86400
        ? { day: 'numeric', month: 'short', timeZone: TZ }
        : { month: 'short', year: '2-digit', timeZone: TZ };
    return new Intl.DateTimeFormat(i18n.language, opts).format(d);
  };
  const shown = active !== null ? report.series[active] : null;

  return (
    <Card style={styles.chartCard}>
      <View style={styles.chartHead}>
        <View style={styles.flex}>
          <Text variant="heading">{t('analytics.chartTitle')}</Text>
          <Text variant="caption" tone="muted">
            {t(`analytics.ranges.${report.range}`)} · {t('analytics.perSlice')}
          </Text>
        </View>
        <View style={styles.tooltipSlot}>
          {shown && active !== null ? (
            <View style={[styles.tooltip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <Text variant="caption" tone="muted">
                {label(active)}
              </Text>
              <Text variant="bodyStrong">{t('analytics.tipVisitors', { n: shown.visitors.toLocaleString(i18n.language) })}</Text>
              <Text variant="caption" tone="muted">
                {t('analytics.tipViews', { n: shown.pageviews.toLocaleString(i18n.language) })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.plot}>
        {/* Recessive grid: 0, half, top */}
        <View style={styles.yAxis}>
          {[top, top / 2, 0].map((v) => (
            <Text key={v} variant="caption" tone="faint">
              {Math.round(v).toLocaleString(i18n.language)}
            </Text>
          ))}
        </View>
        <View style={styles.bars}>
          {[0, 0.5, 1].map((f) => (
            <View key={f} style={[styles.gridLine, { top: `${f * 100}%`, backgroundColor: colors.border }]} />
          ))}
          {report.series.map((s, i) => (
            <Pressable
              key={i}
              style={styles.barHit}
              onHoverIn={() => setActive(i)}
              onHoverOut={() => setActive((a) => (a === i ? null : a))}
              onPress={() => setActive((a) => (a === i ? null : i))}
              accessibilityLabel={`${label(i)}: ${t('analytics.tipVisitors', { n: s.visitors })}`}
            >
              <View
                style={[
                  styles.bar,
                  { height: `${(s.visitors / top) * 100}%`, backgroundColor: colors.accent, opacity: active === null || active === i ? 1 : 0.45 },
                ]}
              />
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.xAxis}>
        <Text variant="caption" tone="muted">
          {label(0)}
        </Text>
        <Text variant="caption" tone="muted">
          {label(Math.floor(buckets / 2))}
        </Text>
        <Text variant="caption" tone="muted">
          {t('analytics.now')}
        </Text>
      </View>
    </Card>
  );
}

/** A "nice" axis top: 1, 2, 2.5 or 5 × a power of ten. */
function niceCeil(v: number) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

/** Top items as horizontal bars (one hue; the number is in text color). */
function Breakdown({ title, rows }: { title: string; rows: AnalyticsCount[] }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const total = rows.reduce((a, r) => a + r.count, 0);
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card style={styles.breakdown}>
      <Text variant="heading">{title}</Text>
      {rows.length === 0 ? (
        <Text tone="muted">{t('analytics.noData')}</Text>
      ) : (
        rows.map((r) => (
          <View key={r.label} style={styles.gapXs}>
            <View style={styles.rowBetween}>
              <Text numberOfLines={1} style={styles.flex}>
                {r.label}
              </Text>
              <Text variant="bodyStrong">
                {r.count.toLocaleString(i18n.language)}
                <Text variant="caption" tone="muted">
                  {'  '}
                  {total ? Math.round((r.count / total) * 100) : 0}%
                </Text>
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.fill, { width: `${(r.count / max) * 100}%`, backgroundColor: colors.accent }]} />
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rangesScroll: { flexGrow: 0 },
  ranges: { gap: spacing.xs, alignItems: 'center' },
  range: { alignSelf: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  kpi: { flexGrow: 1, flexBasis: 160, gap: 4 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  upper: { textTransform: 'uppercase', letterSpacing: 1, fontFamily: fonts.headingMedium },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chartCard: { gap: spacing.md },
  chartHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  tooltipSlot: { minHeight: 58, alignItems: 'flex-end' },
  tooltip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 6, alignItems: 'flex-end' },
  plot: { flexDirection: 'row', height: 200, gap: spacing.sm },
  yAxis: { justifyContent: 'space-between', alignItems: 'flex-end', minWidth: 28 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  barHit: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', minHeight: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 36 },
  breakdown: { flexGrow: 1, flexBasis: 260, gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  gapXs: { gap: 4 },
  flex: { flex: 1 },
});
