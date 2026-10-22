import type { TFunction } from 'i18next';
import type { AppNotification } from '@/data';
import { RANK_TIERS, rankById } from '@/data/ranks';
import { formatDateTime, formatTime, money } from '@/lib/format';

const TZ = 'Europe/Bucharest';

/** Builds the translated title/body of a notification, formatting money and times. */
export function notificationText(n: AppNotification, t: TFunction, locale: string): { title: string; body: string } {
  const d = n.data;
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(d)) if (v !== null && v !== undefined) params[k] = v;
  if (typeof d.amount === 'number') params.amount = money(d.amount, String(d.currency ?? 'RON'), locale);
  if (typeof d.cancelUntil === 'string') params.cancelUntil = formatTime(d.cancelUntil, TZ, locale);
  if (typeof d.endsAt === 'string') params.endsAt = formatDateTime(d.endsAt, TZ, locale);
  if (typeof d.rankId === 'number') params.rank = rankById(d.rankId)?.name ?? String(d.rank ?? '');
  else if (typeof d.rank === 'string') params.rank = RANK_TIERS.find((r) => r.key === d.rank)?.name ?? d.rank;
  if (n.type === 'self_report_reviewed') params.result = d.approved ? t('notifications.selfReportApproved') : t('notifications.selfReportRejected');
  if (n.type === 'appeal_resolved') params.result = d.approved ? t('notifications.appealApproved') : t('notifications.appealRejected');
  const base = `notifications.types.${n.type}` as const;
  return {
    title: t(`${base}.title` as 'notifications.types.rank_up.title', params),
    body: t(`${base}.body` as 'notifications.types.rank_up.body', params),
  };
}

export const NOTIFICATION_ICON: Record<AppNotification['type'], string> = {
  lobby_joined: 'person-add',
  lobby_left: 'person-remove',
  lobby_full: 'flag',
  session_cancelled: 'close-circle',
  auto_cancelled: 'close-circle',
  removed_from_lobby: 'exit',
  chat_message: 'chatbubble',
  reminder_cancel_window: 'alarm',
  checkin_open: 'location',
  payment_succeeded: 'card',
  refund_issued: 'cash',
  results_posted: 'list',
  results_confirmed: 'checkmark-done',
  results_disputed: 'alert-circle',
  rank_up: 'trophy',
  self_report_reviewed: 'shield-checkmark',
  ban_started: 'ban',
  ban_ended: 'checkmark-circle',
  appeal_resolved: 'mail-open',
  payout_sent: 'wallet',
};

/** Where tapping a notification takes you. */
export function notificationHref(n: AppNotification): string | null {
  const id = n.data.sessionId;
  if (n.type === 'rank_up' || n.type === 'self_report_reviewed' || n.type === 'ban_started' || n.type === 'ban_ended' || n.type === 'appeal_resolved') return '/profile';
  if (n.type === 'chat_message' && id) return `/session/${id}/chat`;
  if ((n.type === 'results_posted' || n.type === 'results_confirmed' || n.type === 'results_disputed') && id) return `/session/${id}/results`;
  return id ? `/session/${id}` : null;
}
