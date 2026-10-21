/**
 * Developer menu (demo builds only): statistics + the same controls as the web
 * preview's debug panel, so the demo can be driven on a real iPhone/Android phone.
 * Opened from Settings → Developer menu, or the "Demo version" badge on the welcome screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useReducer, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, confirmDialog, EmptyState, PickerField, Screen, SectionHeader, Text } from '@/components/ui';
import { api } from '@/data';
import { toast } from '@/features/notifications/BannerHost';
import { errorText } from '@/lib/errors';
import { formatDateTime, money } from '@/lib/format';
import { useNow } from '@/lib/live';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

// The developer menu only exists with the demo (mock) backend.
const demo = api.kind === 'mock' ? (require('@/data/mock/debug') as typeof import('@/data/mock/debug')).debug : null;

function useRefreshOnChange() {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => api.realtime.subscribe('sessions', bump), []);
  return bump;
}

function duration(min: number) {
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  return [d ? `${d} d` : '', h ? `${h} h` : '', m || (!d && !h) ? `${m} min` : ''].filter(Boolean).join(' ');
}

export default function DeveloperMenu() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = i18n.language;
  const refresh = useRefreshOnChange();
  const now = useNow(1000);
  const [sessionId, setSessionId] = useState<string | null>(null);

  if (!demo) {
    return (
      <Screen scroll={false}>
        <EmptyState icon="construct-outline" title={t('errors.not_implemented')} />
      </Screen>
    );
  }

  const snap = demo.snapshot();
  const stats = demo.stats();
  const fmt = (m: number) => money(m, 'RON', locale);
  const upcoming = (p: string) => p === 'open' || p === 'locked' || p === 'checkin';
  const selected =
    snap.sessions.find((s) => s.id === sessionId) ??
    snap.sessions.find((s) => upcoming(s.phase) && (s.myStatus || s.isHost)) ??
    snap.sessions.find((s) => upcoming(s.phase)) ??
    snap.sessions[0];

  /** Runs a demo command and reports the result as a banner. */
  const run = (fn: () => unknown) => {
    try {
      const result = fn();
      toast(typeof result === 'string' ? result : t('dev.done'));
    } catch (err) {
      toast(errorText(err, t as never, locale), 'danger');
    }
    refresh();
  };

  const offsetMin = Math.round(snap.offsetMs / 60000);
  const tierOrder = ['rookie', 'amateur', 'clubRacer', 'pro', 'elite'];

  return (
    <Screen>
      <Text variant="title">{t('dev.title')}</Text>
      <Text variant="small" tone="muted">
        {t('dev.subtitle')}
      </Text>

      {/* ── Statistics ─────────────────────────────────────── */}
      <SectionHeader title={t('dev.stats')} />
      <Grid>
        <Stat label={t('dev.users')} value={stats.users} />
        <Stat label={t('dev.onboarded')} value={stats.onboarded} />
        <Stat label={t('dev.hosts')} value={stats.hosts} />
        <Stat label={t('dev.banned')} value={stats.bannedNow} tone={stats.bannedNow ? 'danger' : undefined} />
      </Grid>
      <Text variant="label" tone="muted">
        {t('dev.sessions')} · {stats.sessionsTotal}
      </Text>
      <Grid>
        <Stat label={t('dev.upcoming')} value={stats.upcoming} />
        <Stat label={t('dev.awaitingResults')} value={stats.awaitingResults} />
        <Stat label={t('dev.finished')} value={stats.finished} />
        <Stat label={t('dev.cancelled')} value={stats.cancelled} />
        <Stat label={t('dev.disputed')} value={stats.disputed} tone={stats.disputed ? 'danger' : undefined} />
        <Stat label={t('dev.seats')} value={stats.seatsPaid} />
      </Grid>
      <Text variant="label" tone="muted">
        {t('dev.money')}
      </Text>
      <Grid>
        <Stat label={t('dev.collected')} value={fmt(stats.collectedMinor)} wide />
        <Stat label={t('dev.fees')} value={fmt(stats.platformFeesMinor)} wide tone="accent" />
        <Stat label={t('dev.payouts')} value={fmt(stats.payoutsMinor)} wide />
        <Stat label={`${t('dev.refunded')} · ${t('dev.refundsCount', { count: stats.refunds })}`} value={fmt(stats.refundedMinor)} wide />
      </Grid>
      <Text variant="label" tone="muted">
        {t('dev.community')}
      </Text>
      <Grid>
        <Stat label={t('dev.noShows')} value={stats.noShows} />
        <Stat label={t('dev.appealsPending')} value={stats.appealsPending} />
        <Stat label={t('dev.reports')} value={stats.reportsOpen} />
        <Stat label={t('dev.messages')} value={stats.messages} />
        <Stat label={t('dev.notifications')} value={stats.notifications} />
        <Stat label={t('dev.points')} value={stats.pointsAwarded} />
      </Grid>
      <Card style={styles.gapSm}>
        <Text variant="label" tone="muted">
          {t('dev.ranks')}
        </Text>
        <View style={styles.wrap}>
          {tierOrder.map((k) => (
            <Chip key={k} label={`${t(`ranks.${k}` as 'ranks.rookie')}: ${stats.tiers[k] ?? 0}`} />
          ))}
        </View>
      </Card>
      <Card padded={false}>
        <View style={styles.cardHead}>
          <Text variant="label" tone="muted">
            {t('dev.perTrack')}
          </Text>
        </View>
        {stats.perTrack.map((tr) => (
          <View key={tr.trackId} style={[styles.trackRow, { borderTopColor: colors.border }]}>
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {tr.name}
              </Text>
              <Text variant="caption" tone="muted">
                {t('dev.trackRow', { sessions: tr.sessions, upcoming: tr.upcoming, seats: tr.seatsPaid })}
              </Text>
            </View>
            <Text variant="bodyStrong">{fmt(tr.revenueMinor)}</Text>
          </View>
        ))}
      </Card>

      {/* ── Time ───────────────────────────────────────────── */}
      <SectionHeader title={t('dev.time')} />
      <Card style={styles.gapSm}>
        <Text variant="heading">{formatDateTime(now, 'Europe/Bucharest', locale)}</Text>
        <Text variant="caption" tone={offsetMin ? 'accent' : 'muted'}>
          {offsetMin ? t('dev.offset', { value: `${offsetMin > 0 ? '+' : '−'}${duration(Math.abs(offsetMin))}` }) : t('dev.realTime')}
        </Text>
        <View style={styles.wrap}>
          <Chip label="−1 h" onPress={() => run(() => demo.advance(-60))} />
          <Chip label="+15 min" onPress={() => run(() => demo.advance(15))} />
          <Chip label="+1 h" onPress={() => run(() => demo.advance(60))} />
          <Chip label="+6 h" onPress={() => run(() => demo.advance(360))} />
          <Chip label="+1 d" onPress={() => run(() => demo.advance(1440))} />
          <Chip label={t('dev.backToReal')} onPress={() => run(() => demo.resetClock())} />
        </View>
      </Card>

      {/* ── User & GPS ─────────────────────────────────────── */}
      <SectionHeader title={t('dev.user')} />
      <Card style={styles.gapSm}>
        <PickerField
          label={t('dev.user')}
          placeholder={t('dev.signedOut')}
          value={snap.currentUserId}
          items={snap.users.map((u) => ({ value: u.id, label: `${u.name}${u.banned ? ' ⛔' : ''}`, subtitle: u.email }))}
          onChange={(id) => run(() => demo.switchUser(id))}
        />
        <Text variant="caption" tone="faint">
          {t('dev.password', { password: snap.testPassword })}
        </Text>
        <View style={styles.wrap}>
          <Chip label={t('dev.signOut')} icon="log-out-outline" onPress={() => run(() => demo.signOut())} />
        </View>
        <Text variant="label" tone="muted">
          {t('dev.gps')}
        </Text>
        <View style={styles.wrap}>
          <Chip label={t('dev.atTrack')} icon="location" selected={snap.atTrack} onPress={() => run(() => demo.setAtTrack(true))} />
          <Chip label={t('dev.away')} icon="home-outline" selected={!snap.atTrack} onPress={() => run(() => demo.setAtTrack(false))} />
        </View>
      </Card>

      {/* ── Session controls ───────────────────────────────── */}
      <SectionHeader title={t('dev.session')} />
      {selected ? (
        <Card style={styles.gapSm}>
          <PickerField
            label={t('dev.session')}
            placeholder={t('dev.pickSession')}
            value={selected.id}
            items={snap.sessions.map((s) => ({
              value: s.id,
              label: s.label,
              subtitle: `${formatDateTime(s.startsAt, 'Europe/Bucharest', locale)} · ${s.phase} · ${s.paid}/${s.max}${s.isHost ? ' · host' : s.myStatus ? ` · ${s.myStatus}` : ''}`,
            }))}
            onChange={setSessionId}
          />
          <Button title={t('dev.openLobby')} size="md" onPress={() => router.push(`/session/${selected.id}`)} icon={<Ionicons name="flag" size={16} color="#fff" />} />
          <Text variant="label" tone="muted">
            {t('dev.jumpTo')}
          </Text>
          <View style={styles.wrap}>
            {(
              [
                ['j3h', -181],
                ['j2h', -120],
                ['j61', -61],
                ['j59', -59],
                ['j10', -10],
                ['j16', 16],
                ['j25h', 25 * 60 + 30],
              ] as const
            ).map(([key, minutes]) => (
              <Chip key={key} label={t(`dev.${key}`)} onPress={() => run(() => demo.jumpToSession(selected.id, minutes))} />
            ))}
          </View>
          <Text variant="label" tone="muted">
            {t('dev.others')}
          </Text>
          <View style={styles.wrap}>
            <Chip label={t('dev.join')} onPress={() => run(() => demo.someoneJoins(selected.id))} />
            <Chip label={t('dev.enterUnpaid')} onPress={() => run(() => demo.someoneEntersUnpaid(selected.id))} />
            <Chip label={t('dev.fill')} onPress={() => run(() => demo.fillLobby(selected.id))} />
            <Chip label={t('dev.leave')} onPress={() => run(() => demo.someoneLeaves(selected.id))} />
            <Chip label={t('dev.chat')} onPress={() => run(() => demo.someoneChats(selected.id))} />
            <Chip label={t('dev.checkIn')} onPress={() => run(() => demo.othersCheckIn(selected.id))} />
          </View>
          <Text variant="label" tone="muted">
            {t('dev.resultsAdmin')}
          </Text>
          <View style={styles.wrap}>
            <Chip label={t('dev.confirmAll')} onPress={() => run(() => demo.othersRespond(selected.id, 'confirm'))} />
            <Chip label={t('dev.dispute')} onPress={() => run(() => demo.othersRespond(selected.id, 'dispute'))} />
            <Chip label={t('dev.approve')} onPress={() => run(() => demo.adminDecide(selected.id, true))} />
            <Chip label={t('dev.reject')} onPress={() => run(() => demo.adminDecide(selected.id, false))} />
            <Chip label={t('dev.trackCancels')} tone="danger" onPress={() => run(() => demo.trackCancels(selected.id))} />
          </View>
        </Card>
      ) : null}

      {/* ── Appeals ────────────────────────────────────────── */}
      {snap.appeals.length ? (
        <>
          <SectionHeader title={t('dev.appeals')} />
          <Card style={styles.gapSm}>
            {snap.appeals.map((a) => (
              <View key={a.banId} style={styles.gapXs}>
                <Text>
                  <Text variant="bodyStrong">{a.userName}</Text>: “{a.message}” · {a.status}
                </Text>
                {a.status === 'pending' ? (
                  <View style={styles.wrap}>
                    <Chip label={t('dev.approveAppeal')} tone="success" onPress={() => run(() => demo.resolveAppeal(a.banId, true))} />
                    <Chip label={t('dev.rejectAppeal')} tone="danger" onPress={() => run(() => demo.resolveAppeal(a.banId, false))} />
                  </View>
                ) : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* ── Email inbox ────────────────────────────────────── */}
      <SectionHeader title={`${t('dev.inbox')} (${snap.emails.length})`} />
      <Card style={styles.gapSm}>
        {snap.emails.length === 0 ? (
          <Text tone="muted">{t('dev.noEmails')}</Text>
        ) : (
          snap.emails.map((e) => (
            <View key={e.id} style={styles.emailRow}>
              <View style={styles.flex}>
                <Text variant={e.opened ? 'small' : 'bodyStrong'} numberOfLines={2}>
                  {e.subject}
                </Text>
                <Text variant="caption" tone="muted">
                  {e.to}
                </Text>
              </View>
              <Chip
                label={t('dev.openLink')}
                onPress={() => {
                  demo.emailHtml(e.id); // marks it as opened
                  router.push(demo.emailLink(e.id) as never);
                }}
              />
            </View>
          ))
        )}
      </Card>

      {/* ── Data ───────────────────────────────────────────── */}
      <SectionHeader title={t('dev.data')} />
      <Button
        title={t('dev.reset')}
        variant="danger"
        onPress={async () => {
          const ok = await confirmDialog({ title: t('dev.reset'), message: t('dev.resetConfirm'), confirmText: t('dev.reset'), cancelText: t('common.cancel'), destructive: true });
          if (ok) run(() => demo.reset());
        }}
      />
    </Screen>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

function Stat({ label, value, tone, wide }: { label: string; value: string | number; tone?: 'danger' | 'accent'; wide?: boolean }) {
  return (
    <Card style={[styles.stat, wide && styles.statWide]}>
      <Text variant="heading" tone={tone}>
        {value}
      </Text>
      <Text variant="caption" tone="muted" numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexBasis: '31%', flexGrow: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.md, gap: 2 },
  statWide: { flexBasis: '47%' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  gapSm: { gap: spacing.sm },
  gapXs: { gap: spacing.xs },
  cardHead: { padding: spacing.md },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
