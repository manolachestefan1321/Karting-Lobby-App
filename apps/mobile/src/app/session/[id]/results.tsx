import { formatLapTime, parseLapTime } from '@kartup/domain';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Card, Chip, EmptyState, LoadingState, promptDialog, Screen, SectionHeader, Text } from '@/components/ui';
import type { LobbyMember } from '@/data';
import { useAuth, useMyId } from '@/features/auth/AuthProvider';
import { Breakdown } from '@/features/profile/Breakdown';
import { toast } from '@/features/notifications/BannerHost';
import { phaseOf } from '@/features/sessions/components';
import { useMembers, useRespondResults, useResults, useSession, useSubmitResults } from '@/features/sessions/hooks';
import { useRulesOrDefault } from '@/features/sessions/rules';
import { errorText } from '@/lib/errors';
import { relative } from '@/lib/format';
import { pickSquareImage } from '@/lib/image';
import { useNow } from '@/lib/live';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export default function ResultsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const myId = useMyId();
  const { profile } = useAuth();
  const now = useNow(10_000);
  const rules = useRulesOrDefault();
  const session = useSession(id);
  const members = useMembers(id);
  const results = useResults(id);

  if (session.isPending || results.isPending || members.isPending) return <LoadingState />;
  const s = session.data;
  if (!s) return <EmptyState icon="flag-outline" title={t('errors.not_found')} />;
  const phase = phaseOf(s, now, rules);
  const isHost = s.host.id === myId;
  const isAdmin = profile?.role === 'admin';

  if (!results.data) {
    if ((isHost || isAdmin) && phase === 'awaiting_results') return <EnterResults sessionId={id} members={members.data ?? []} asAdmin={!isHost} instant={rules.demoInstantResults} />;
    return (
      <Screen scroll={false}>
        <EmptyState icon="time-outline" title={t('results.notAvailable')} body={phase === 'awaiting_results' ? t('lobby.resultsWaiting') : undefined} />
      </Screen>
    );
  }
  return <ViewResults sessionId={id} members={members.data ?? []} isHost={isHost} locale={i18n.language} />;
}

function ViewResults({ sessionId, members, isHost, locale }: { sessionId: string; members: LobbyMember[]; isHost: boolean; locale: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const myId = useMyId();
  const now = useNow(10_000);
  const results = useResults(sessionId).data!;
  const respond = useRespondResults();
  const byId = new Map(members.map((m) => [m.id, m]));
  const respondents = results.entries.filter((e) => e.userId !== results.submittedBy);
  const confirmed = results.responses.filter((r) => r.response === 'confirm').length;
  const mine = results.responses.find((r) => r.userId === myId);
  const classified = results.entries.some((e) => e.userId === myId);
  const noShows = members.filter((m) => m.status === 'no_show');
  const fail = (e: unknown) => toast(errorText(e, t as never, locale), 'danger');

  const statusText =
    results.status === 'final'
      ? t('results.statusFinal')
      : results.status === 'disputed'
        ? t('results.statusDisputed')
        : results.status === 'rejected'
          ? t('results.statusRejected')
          : t('results.statusPending', { when: relative(results.deadline, now, locale) });
  const tone = results.status === 'final' ? 'success' : results.status === 'pending' ? 'warning' : 'danger';

  const dispute = async () => {
    const comment = await promptDialog({ title: t('results.disputeTitle'), placeholder: t('results.disputePlaceholder'), confirmText: t('results.dispute'), cancelText: t('common.cancel'), destructive: true });
    if (comment) respond.mutate({ id: sessionId, response: 'dispute', comment }, { onError: fail });
  };

  const canRespond = !isHost && classified && !mine && results.status === 'pending';
  return (
    <Screen
      footer={
        canRespond ? (
          <>
            <Button title={t('results.confirm')} onPress={() => respond.mutate({ id: sessionId, response: 'confirm' }, { onError: fail })} loading={respond.isPending} />
            <Button title={t('results.dispute')} variant="danger" onPress={() => void dispute()} />
          </>
        ) : undefined
      }
    >
      <Text variant="title">{t('results.title')}</Text>
      <View style={styles.row}>
        <Chip label={statusText} tone={tone} />
        {results.source === 'admin' ? (
          <Chip label={t('results.enteredByAdmin')} />
        ) : results.status !== 'final' || results.responses.length ? (
          <Chip label={t('results.confirmations', { confirmed, total: respondents.length })} />
        ) : null}
      </View>
      <Text variant="small" tone="muted">
        {results.lobbyType === 'casual' ? t('results.casualNote') : results.status === 'final' ? t('results.verifiedNote') : t('results.pendingNote')}
      </Text>
      {mine ? <Text tone="muted">{mine.response === 'confirm' ? t('results.youConfirmed') : t('results.youDisputed')}</Text> : null}

      <Card padded={false}>
        {results.entries.map((e) => {
          const m = byId.get(e.userId);
          const name = m ? `${m.firstName} ${m.lastName}` : '—';
          const podium = e.position <= 3;
          return (
            <View key={e.userId} style={[styles.entry, e.userId === myId && { backgroundColor: colors.surfaceAlt }]}>
              <Text variant="title" style={[styles.pos, podium && { color: e.position === 1 ? '#E5A000' : colors.text }]}>
                {e.position}
              </Text>
              <Avatar uri={m?.avatarUrl} name={name} size={36} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {name}
                </Text>
                <Text variant="caption" tone="muted">
                  {t('results.lapsShort', { count: e.laps })}
                  {e.bestLapMs ? ` · ${t('results.bestLap')} ${formatLapTime(e.bestLapMs)}` : ''}
                </Text>
                {e.breakdown ? <Breakdown b={e.breakdown} /> : null}
              </View>
              {e.xp !== null ? (
                <View style={styles.gain}>
                  <Text variant="heading" tone="accent">
                    {t('results.xpGained', { xp: e.xp })}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {t('results.kmGained', { km: Math.round((e.km ?? 0) * 10) / 10 })}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      {noShows.length ? (
        <>
          <SectionHeader title={t('results.noShows')} />
          <Text tone="muted">{noShows.map((m) => `${m.firstName} ${m.lastName}`).join(', ')}</Text>
        </>
      ) : null}

      {results.printoutUrl ? (
        <>
          <SectionHeader title={t('results.printout')} />
          <Image source={{ uri: results.printoutUrl }} style={styles.printout} contentFit="cover" accessibilityLabel={t('results.printout')} />
        </>
      ) : null}
    </Screen>
  );
}

function EnterResults({ sessionId, members, asAdmin, instant }: { sessionId: string; members: LobbyMember[]; asAdmin: boolean; instant: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const submit = useSubmitResults();
  const attended = members.filter((m) => m.status === 'attended');
  const [order, setOrder] = useState<string[]>([]);
  const [bestLaps, setBestLaps] = useState<Record<string, string>>({});
  const [lapCounts, setLapCounts] = useState<Record<string, string>>({});
  const [printout, setPrintout] = useState<string | null>(null);
  const remaining = attended.filter((m) => !order.includes(m.id));
  const byId = new Map(members.map((m) => [m.id, m]));

  const onSubmit = () => {
    if (order.some((uid) => !/^\d{1,3}$/.test(lapCounts[uid] ?? ''))) return toast(t('results.lapsRequired'), 'danger');
    if (Object.entries(bestLaps).some(([, v]) => v.trim() && parseLapTime(v) === null)) return toast(t('validation.lapTime'), 'danger');
    const entries = order.map((userId, i) => ({ userId, position: i + 1, laps: Number(lapCounts[userId]), bestLapMs: bestLaps[userId] ? parseLapTime(bestLaps[userId]!) : null }));
    submit.mutate(
      { id: sessionId, entries, printoutUri: printout },
      {
        // The screen switches to the submitted results (with XP and km once final).
        onSuccess: () => toast(t('results.submitted')),
        onError: (e) => toast(errorText(e, t as never, i18n.language), 'danger'),
      },
    );
  };

  return (
    <Screen footer={<Button title={t('results.submit')} onPress={onSubmit} disabled={remaining.length > 0 || order.length === 0} loading={submit.isPending} />}>
      <Text variant="title">{t('results.enterTitle')}</Text>
      <Text tone="muted">{t('results.enterHint')}</Text>
      {asAdmin ? <Chip label={t('results.adminEntry')} tone="accent" /> : null}

      {order.length ? (
        <Card padded={false}>
          {order.map((uid, i) => {
            const m = byId.get(uid)!;
            return (
              <View key={uid} style={styles.entry}>
                <Text variant="title" style={styles.pos}>
                  {i + 1}
                </Text>
                <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                  {m.firstName} {m.lastName}
                </Text>
                <TextInput
                  value={lapCounts[uid] ?? ''}
                  onChangeText={(v) => setLapCounts((l) => ({ ...l, [uid]: v.replace(/[^0-9]/g, '') }))}
                  placeholder={t('results.laps')}
                  placeholderTextColor={colors.textFaint}
                  keyboardType="number-pad"
                  maxLength={3}
                  accessibilityLabel={`${t('results.laps')} ${m.firstName}`}
                  style={[styles.lapsInput, { color: colors.text, borderColor: colors.border }]}
                />
                <TextInput
                  value={bestLaps[uid] ?? ''}
                  onChangeText={(v) => setBestLaps((l) => ({ ...l, [uid]: v }))}
                  placeholder={t('results.lapPlaceholder')}
                  placeholderTextColor={colors.textFaint}
                  accessibilityLabel={`${t('results.bestLap')} ${m.firstName}`}
                  style={[styles.lapInput, { color: colors.text, borderColor: colors.border }]}
                />
              </View>
            );
          })}
          <Pressable onPress={() => setOrder([])} style={styles.reset} accessibilityRole="button">
            <Text tone="accent">{t('results.reset')}</Text>
          </Pressable>
        </Card>
      ) : null}

      {remaining.length ? (
        <View style={styles.pool}>
          {remaining.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setOrder((o) => [...o, m.id])}
              accessibilityRole="button"
              accessibilityLabel={`${m.firstName} ${m.lastName} → P${order.length + 1}`}
              style={[styles.poolItem, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Avatar uri={m.avatarUrl} name={`${m.firstName} ${m.lastName}`} size={32} />
              <Text variant="bodyStrong">{m.firstName}</Text>
              <Text variant="caption" tone="accent">
                P{order.length + 1}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <SectionHeader title={t('results.printout')} />
      {printout ? <Image source={{ uri: printout }} style={styles.printout} contentFit="cover" /> : null}
      <Button
        title={printout ? t('results.changePrintout') : t('results.addPrintout')}
        variant="secondary"
        icon={<Ionicons name="camera-outline" size={18} color={colors.text} />}
        onPress={async () => {
          const r = await pickSquareImage('library', 1200);
          if (r.status === 'ok') setPrintout(r.uri);
        }}
      />
      <Text variant="caption" tone="muted">
        {asAdmin ? t('results.adminEntry') : instant ? t('results.submitHintDemo') : t('results.submitHint')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  flex: { flex: 1, gap: 2 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pos: { width: 28, textAlign: 'center', fontStyle: 'italic' },
  lapsInput: { width: 56, minHeight: 38, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, fontSize: 15, textAlign: 'center' },
  gain: { alignItems: 'flex-end' },
  lapInput: { width: 96, minHeight: 38, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.sm, fontSize: 15 },
  reset: { padding: spacing.md, alignItems: 'flex-end' },
  pool: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  poolItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.pill, paddingRight: spacing.md, paddingLeft: 4, paddingVertical: 4 },
  printout: { width: '100%', aspectRatio: 1, borderRadius: radius.md },
});
