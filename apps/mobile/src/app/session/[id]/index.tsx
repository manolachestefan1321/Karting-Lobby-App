import { checkinWindow, hostPayoutMinor, participantCancellation, refundDeadline } from '@kartup/domain';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Card, Chip, confirmDialog, EmptyState, ErrorState, LoadingState, Screen, SectionHeader, Text } from '@/components/ui';
import { api, type LobbyMember, type PaymentIntentInfo, type RankTier } from '@/data';
import { useMyId } from '@/features/auth/AuthProvider';
import { toast } from '@/features/notifications/BannerHost';
import { PaymentSheet } from '@/features/payments/PaymentSheet';
import { usePublicProfile, useRankTiers } from '@/features/profile/api';
import { RankBadge } from '@/features/profile/ProfileView';
import { PhaseBadge, phaseOf } from '@/features/sessions/components';
import {
  useCancelSeat,
  useCancelSession,
  useCheckIn,
  useConfirmAttendance,
  useLeaveLobby,
  useMembers,
  useMessages,
  useRemoveMember,
  useSession,
} from '@/features/sessions/hooks';
import { useRulesOrDefault } from '@/features/sessions/rules';
import { errorText } from '@/lib/errors';
import { countdown, formatDateTime, formatTime, money, relative } from '@/lib/format';
import { useNow } from '@/lib/live';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function LobbyScreen() {
  const { id, pay } = useLocalSearchParams<{ id: string; pay?: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const locale = i18n.language;
  const myId = useMyId();
  const now = useNow(1000);
  const rules = useRulesOrDefault();
  const session = useSession(id);
  const members = useMembers(id);
  const messages = useMessages(id);
  const me = usePublicProfile(myId);
  const tiers = useRankTiers();
  const cancelSeat = useCancelSeat();
  const leave = useLeaveLobby();
  const removeMember = useRemoveMember();
  const cancelSession = useCancelSession();
  const checkIn = useCheckIn();
  const confirmAttendance = useConfirmAttendance();
  const [intent, setIntent] = useState<PaymentIntentInfo | null>(null);
  const [paying, setPaying] = useState(false);

  const fail = (err: unknown) => toast(errorText(err, t as never, locale), 'danger');

  const startPayment = async () => {
    setPaying(true);
    try {
      setIntent(await api.payments.createIntent(id));
    } catch (err) {
      fail(err);
    } finally {
      setPaying(false);
    }
  };

  // Coming from "Create session": open the payment sheet for the host's own seat.
  const [autoPayDone, setAutoPayDone] = useState(false);
  useEffect(() => {
    if (pay === '1' && !autoPayDone && session.data?.myStatus === 'joined_unpaid') {
      setAutoPayDone(true);
      void startPayment();
    }
  }, [pay, autoPayDone, session.data?.myStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session.isPending) return <LoadingState />;
  if (session.isError) return <ErrorState onRetry={() => void session.refetch()} />;
  const s = session.data;
  if (!s) return <EmptyState icon="flag-outline" title={t('errors.not_found')} />;

  const tz = s.track.timezone;
  const phase = phaseOf(s, now, rules);
  const isHost = s.host.id === myId;
  const my = s.myStatus;
  const paid = my === 'confirmed';
  const started = now.getTime() >= new Date(s.startsAt).getTime();
  const spotsLeft = s.maxDrivers - s.paidCount;
  const ban = me.data?.activeBan ?? null;
  const cancelDecision = participantCancellation(new Date(s.startsAt), now, rules);
  const win = checkinWindow(new Date(s.startsAt), rules);
  const fmt = (m: number) => money(m, s.price.currency, locale);
  const list = (members.data ?? []).filter((m) => m.status !== 'removed' && m.status !== 'cancelled');
  const minTier = tiers.data?.find((x) => x.id === s.minRankTierId);
  const autoCancelAt = new Date(new Date(s.startsAt).getTime() - rules.autoCancelBeforeMinutes * 60_000);
  const memberish = isHost || (my !== null && my !== 'removed');

  const onCancelSeat = async () => {
    const ok = await confirmDialog({
      title: t('lobby.cancelConfirmTitle'),
      message: t('lobby.cancelConfirmBody', { amount: fmt(s.price.totalMinor) }),
      confirmText: t('lobby.cancelSeat'),
      cancelText: t('common.back'),
      destructive: true,
    });
    if (!ok) return;
    cancelSeat.mutate(id, { onSuccess: () => toast(t('lobby.cancelledToast', { amount: fmt(s.price.totalMinor) })), onError: fail });
  };

  const onRemove = async (m: LobbyMember) => {
    const name = `${m.firstName} ${m.lastName}`;
    const ok = await confirmDialog({
      title: t('lobby.remove'),
      message: m.status === 'confirmed' ? t('lobby.removeConfirmPaid', { name }) : t('lobby.removeConfirmUnpaid', { name }),
      confirmText: t('lobby.remove'),
      cancelText: t('common.back'),
      destructive: true,
    });
    if (ok) removeMember.mutate({ id, userId: m.id }, { onError: fail });
  };

  const onCancelSession = async () => {
    const ok = await confirmDialog({ title: t('lobby.cancelSession'), message: t('lobby.cancelSessionConfirm'), confirmText: t('lobby.cancelSession'), cancelText: t('common.back'), destructive: true });
    if (ok) cancelSession.mutate({ id, reason: 'host' }, { onError: fail });
  };

  // ── Footer: the one main action for the current state ─────────────────────────
  let footer: React.ReactNode = null;
  if (!s.cancelledAt && !started) {
    if (!my || my === 'cancelled' || my === 'removed') {
      if (!ban && spotsLeft > 0) footer = <Button title={t('lobby.joinPay', { amount: fmt(s.price.totalMinor) })} onPress={() => void startPayment()} loading={paying} />;
    } else if (my === 'joined_unpaid') {
      footer = (
        <>
          <Button title={t('lobby.payNow', { amount: fmt(s.price.totalMinor) })} onPress={() => void startPayment()} loading={paying} disabled={!!ban || spotsLeft <= 0} />
          {isHost ? (
            <Button title={t('lobby.cancelSession')} variant="danger" onPress={() => void onCancelSession()} />
          ) : (
            <Button title={t('lobby.leaveLobby')} variant="ghost" onPress={() => leave.mutate(id, { onError: fail })} />
          )}
        </>
      );
    } else if (paid && isHost) {
      footer = <Button title={t('lobby.cancelSession')} variant="danger" onPress={() => void onCancelSession()} loading={cancelSession.isPending} />;
    } else if (paid) {
      footer = cancelDecision.allowed ? (
        <>
          <Text variant="small" tone="muted" align="center">
            {t('lobby.cancelUntil', { time: formatDateTime(refundDeadline(new Date(s.startsAt), rules), tz, locale) })}
          </Text>
          <Button title={t('lobby.cancelSeat')} variant="danger" onPress={() => void onCancelSeat()} loading={cancelSeat.isPending} />
        </>
      ) : (
        <Text variant="small" tone="muted" align="center">
          <Ionicons name="lock-closed" size={12} /> {t('lobby.cancelClosed')}
        </Text>
      );
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <Screen footer={footer}>
        <View style={styles.head}>
          <View style={styles.rowWrap}>
            <PhaseBadge phase={phase} />
            {isHost ? <Chip label={t('sessions.youHost')} tone="accent" icon="flag" /> : null}
            {paid || my === 'attended' ? <Chip label={t('sessions.youreIn')} tone="success" icon="checkmark" /> : null}
          </View>
          <Text variant="title">{s.track.name}</Text>
          <Text tone="muted">
            {formatDateTime(s.startsAt, tz, locale)} · {t('lobby.localTime', { time: formatTime(s.startsAt, tz, locale) })}
          </Text>
          <Text variant="small" tone="faint">
            {s.track.address}
          </Text>
        </View>

        {/* Status banners */}
        {s.cancelledAt ? (
          <Banner tone="danger" icon="close-circle" text={s.cancelledBy === 'system' ? t('lobby.autoCancelledBanner', { min: rules.minDrivers }) : t('lobby.cancelledBanner')} />
        ) : null}
        {ban && !s.cancelledAt && !started && !paid ? <Banner tone="danger" icon="ban" text={t('lobby.youreBanned', { time: formatDateTime(ban.endsAt ?? s.startsAt, 'Europe/Bucharest', locale) })} /> : null}
        {my === 'no_show' ? <Banner tone="danger" icon="ban" text={t('lobby.noShowYou')} /> : null}
        {!s.cancelledAt && !started && s.paidCount < rules.minDrivers ? (
          <Banner tone="warning" icon="alert-circle" text={t('lobby.minDriversWarning', { min: rules.minDrivers, time: formatDateTime(autoCancelAt, tz, locale) })} />
        ) : null}

        {/* Countdown */}
        {!s.cancelledAt && !started ? (
          <Card style={styles.countdown}>
            <Text variant="label" tone="muted">
              {t('lobby.startsIn')}
            </Text>
            <Text variant="display" style={styles.clock} accessibilityLiveRegion="none">
              {countdown(s.startsAt, now)}
            </Text>
          </Card>
        ) : null}

        {/* Price */}
        <Card style={styles.gapSm}>
          <View style={styles.rowBetween}>
            <Text variant="label" tone="muted">
              {t('lobby.price')}
            </Text>
            <Text variant="title">{fmt(s.price.totalMinor)}</Text>
          </View>
          <Text variant="small" tone="muted">
            {t('lobby.priceBreakdown', { track: fmt(s.price.trackMinor), fee: fmt(s.price.feeMinor) })}
          </Text>
          <Text variant="caption" tone="faint">
            {t('lobby.priceUpdated', { when: relative(s.priceUpdatedAt, now, locale) })}
          </Text>
          {!s.track.price.verified ? (
            <View style={styles.rowWrap}>
              <Chip label={t('lobby.priceToVerify')} tone="warning" icon="alert-circle-outline" />
              {s.track.price.sourceUrl ? (
                <Text variant="caption" tone="accent" onPress={() => void Linking.openURL(s.track.price.sourceUrl!)}>
                  {t('lobby.priceSource')} ↗
                </Text>
              ) : null}
            </View>
          ) : null}
          {s.track.price.note ? (
            <Text variant="caption" tone="muted">
              {s.track.price.note}
            </Text>
          ) : null}
          {isHost ? (
            <Text variant="small" tone="accent">
              {t('lobby.payoutInfo', { amount: fmt(hostPayoutMinor(s.price.trackMinor, ['confirmed'])) })}
            </Text>
          ) : null}
        </Card>

        <View style={styles.rowWrap}>
          {s.isOfficialEvent ? <Chip label={t('sessions.official')} tone="accent" icon="trophy" /> : null}
          <Chip label={t(s.track.lapLengthVerified ? 'lobby.lapLength' : 'lobby.lapLengthToVerify', { m: s.track.lapLengthM })} icon="speedometer-outline" />
        </View>

        {s.minSkill || minTier ? (
          <View style={styles.rowWrap}>
            <Text variant="label" tone="muted">
              {t('lobby.requirements')}
            </Text>
            {s.minSkill ? <Chip label={t('sessions.minSkill', { level: t(`profile.level.${s.minSkill}`) })} /> : null}
            {minTier ? <Chip label={t('sessions.minRank', { rank: minTier.name })} /> : null}
          </View>
        ) : null}

        {s.note ? (
          <Card style={styles.gapSm}>
            <Text variant="label" tone="muted">
              {t('lobby.note')}
            </Text>
            <Text>{s.note}</Text>
          </Card>
        ) : null}

        {/* Check-in */}
        {paid && !s.cancelledAt && (phase === 'open' || phase === 'locked' || phase === 'checkin') ? (
          <Card style={styles.gapSm}>
            <SectionHeader title={t('lobby.checkinTitle')} />
            {list.find((m) => m.id === myId)?.checkedInAt ? (
              <Text tone="success" variant="bodyStrong">
                {t('lobby.checkedIn')}
              </Text>
            ) : phase === 'checkin' ? (
              <Button title={t('lobby.checkin')} icon={<Ionicons name="location" size={18} color="#fff" />} onPress={() => checkIn.mutate(id, { onError: fail })} loading={checkIn.isPending} />
            ) : (
              <Text>{t('lobby.checkinOpensAt', { time: formatTime(win.opens, tz, locale) })}</Text>
            )}
            <Text variant="caption" tone="muted">
              {isHost && phase === 'checkin' ? t('lobby.hostAttendanceHint') : t('lobby.checkinHint')}
            </Text>
          </Card>
        ) : null}

        {/* Results */}
        {!s.cancelledAt && (phase === 'awaiting_results' || phase === 'results_pending' || phase === 'disputed' || phase === 'final') ? (
          <Card style={styles.gapSm}>
            <SectionHeader title={t('results.title')} />
            {s.resultsStatus ? (
              <Button title={t('lobby.viewResults')} variant="secondary" onPress={() => router.push(`/session/${id}/results`)} />
            ) : isHost ? (
              <Button title={t('lobby.enterResults')} onPress={() => router.push(`/session/${id}/results`)} />
            ) : (
              <Text tone="muted">{t('lobby.resultsWaiting')}</Text>
            )}
          </Card>
        ) : null}

        {/* Drivers */}
        <SectionHeader title={`${t('lobby.participants')} · ${t('sessions.drivers', { paid: s.paidCount, max: s.maxDrivers })}`} />
        <Card padded={false}>
          {list.map((m) => (
            <MemberRow
              key={m.id}
              m={m}
              tiers={tiers.data ?? []}
              isMe={m.id === myId}
              hostView={isHost}
              canRemove={isHost && !m.isHost && !started && (m.status === 'confirmed' || m.status === 'joined_unpaid')}
              canMark={isHost && phase === 'checkin' && m.status === 'confirmed' && !m.checkedInAt}
              onRemove={() => void onRemove(m)}
              onMark={() => confirmAttendance.mutate({ id, userId: m.id, attended: !m.hostConfirmed }, { onError: fail })}
            />
          ))}
        </Card>

        {/* Chat preview */}
        <SectionHeader title={t('lobby.chat')} />
        <Card style={styles.gapSm} onPress={memberish ? () => router.push(`/session/${id}/chat`) : undefined} accessibilityLabel={t('lobby.chat')}>
          {!memberish ? (
            <Text tone="muted">{t('lobby.chatLocked')}</Text>
          ) : (messages.data ?? []).filter((m) => !m.system).length === 0 ? (
            <Text tone="muted">{t('lobby.noMessages')}</Text>
          ) : (
            (messages.data ?? [])
              .filter((m) => !m.system)
              .slice(-3)
              .map((m) => (
                <Text key={m.id} numberOfLines={1}>
                  <Text variant="bodyStrong">{m.author.firstName}: </Text>
                  {m.body}
                </Text>
              ))
          )}
          {memberish ? (
            <View style={styles.rowEnd}>
              <Text tone="accent" variant="bodyStrong">
                {t('lobby.chat')} →
              </Text>
            </View>
          ) : null}
        </Card>
      </Screen>

      <PaymentSheet
        intent={intent}
        onClose={() => setIntent(null)}
        onResult={(outcome) => {
          setIntent(null);
          if (outcome.status === 'seat_confirmed') toast(t('payment.success'));
          else if (outcome.status === 'session_full_released') toast(t('payment.releasedFull'), 'danger');
        }}
      />
    </>
  );
}

function Banner({ tone, icon, text }: { tone: 'danger' | 'warning'; icon: 'ban' | 'close-circle' | 'alert-circle'; text: string }) {
  const { colors } = useTheme();
  const c = tone === 'danger' ? colors.danger : colors.warning;
  return (
    <View style={[styles.banner, { borderColor: c }]} accessibilityRole="alert">
      <Ionicons name={icon} size={20} color={c} />
      <Text variant="small" style={{ color: c, flex: 1, fontWeight: '600' }}>
        {text}
      </Text>
    </View>
  );
}

function MemberRow({
  m,
  tiers,
  isMe,
  hostView,
  canRemove,
  canMark,
  onRemove,
  onMark,
}: {
  m: LobbyMember;
  tiers: RankTier[];
  isMe: boolean;
  hostView: boolean;
  canRemove: boolean;
  canMark: boolean;
  onRemove: () => void;
  onMark: () => void;
}) {
  const { t } = useTranslation();
  const tier = tiers.find((x) => x.id === m.rankTierId);
  const name = `${m.firstName} ${m.lastName}`;
  return (
    <View style={styles.member}>
      <Pressable style={styles.memberMain} onPress={() => router.push(isMe ? '/profile' : `/user/${m.id}`)} accessibilityRole="button" accessibilityLabel={name}>
        <Avatar uri={m.avatarUrl} name={name} size={40} ringColor={tier?.color} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {name}
            {isMe ? ` (${t('leaderboard.you')})` : ''}
          </Text>
          <View style={styles.rowWrapTight}>
            {tier ? <RankBadge tier={tier} small /> : null}
            {m.isHost ? <Chip label={t('lobby.host')} tone="accent" /> : null}
            {m.status === 'joined_unpaid' ? <Chip label={t('lobby.statusUnpaid')} tone="warning" /> : null}
            {m.status === 'confirmed' && !m.checkedInAt && !m.hostConfirmed ? <Chip label={t('lobby.statusPaid')} tone="success" /> : null}
            {m.checkedInAt ? <Chip label={t('lobby.statusCheckedIn')} tone="success" icon="location" /> : null}
            {m.hostConfirmed && !m.checkedInAt ? <Chip label={t('lobby.statusPresent')} tone="success" /> : null}
            {m.status === 'no_show' ? <Chip label={t('lobby.statusNoShow')} tone="danger" /> : null}
          </View>
        </View>
      </Pressable>
      {canMark ? <Button title={m.hostConfirmed ? t('lobby.unmarkPresent') : t('lobby.markPresent')} variant="secondary" size="md" fullWidth={false} onPress={onMark} /> : null}
      {canRemove && hostView ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`${t('lobby.remove')} ${name}`} hitSlop={10} style={styles.remove}>
          <Ionicons name="close-circle-outline" size={24} color="#FF453A" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' },
  rowWrapTight: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center', marginTop: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowEnd: { flexDirection: 'row', justifyContent: 'flex-end' },
  gapSm: { gap: spacing.sm },
  countdown: { alignItems: 'center', gap: 2 },
  clock: { fontVariant: ['tabular-nums'], fontStyle: 'italic' },
  banner: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', borderWidth: 1.5, borderRadius: 10, padding: spacing.md },
  member: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  memberMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  remove: { padding: 4 },
});
