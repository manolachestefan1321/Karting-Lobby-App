import { HOUR, MINUTE, type RulesConfig } from './rules.ts';

/**
 * Time-based rules of a session. Every function takes `now` explicitly so the
 * server, the tests and the preview's fake clock all behave identically.
 * Times are absolute instants (Date / epoch ms) — UTC by nature.
 */

export type SessionPhase =
  | 'cancelled'
  /** More than the refund cutoff before start: join, cancel with refund. */
  | 'open'
  /** Inside the last hour, before check-in opens: joining allowed (no refund), cancelling not. */
  | 'locked'
  /** Check-in window (−30 min … +15 min around start). */
  | 'checkin'
  /** Check-in closed; waiting for the host to enter results. */
  | 'awaiting_results'
  /** Results submitted; participants may confirm or dispute. */
  | 'results_pending'
  | 'disputed'
  | 'final';

export interface PhaseInput {
  startsAt: Date | number;
  cancelled: boolean;
  resultsStatus?: 'pending' | 'disputed' | 'final' | null;
}

const ms = (d: Date | number) => (typeof d === 'number' ? d : d.getTime());

export function sessionPhase(s: PhaseInput, now: Date | number, rules: RulesConfig): SessionPhase {
  if (s.cancelled) return 'cancelled';
  if (s.resultsStatus === 'final') return 'final';
  if (s.resultsStatus === 'disputed') return 'disputed';
  if (s.resultsStatus === 'pending') return 'results_pending';
  const t = ms(now);
  const start = ms(s.startsAt);
  if (t < start - rules.cancelRefundCutoffMinutes * MINUTE) return 'open';
  if (t < start - rules.checkinOpensBeforeMinutes * MINUTE) return 'locked';
  if (t < start + rules.checkinClosesAfterMinutes * MINUTE) return 'checkin';
  return 'awaiting_results';
}

/** Instant until which a participant can cancel with a full refund. */
export function refundDeadline(startsAt: Date | number, rules: RulesConfig): Date {
  return new Date(ms(startsAt) - rules.cancelRefundCutoffMinutes * MINUTE);
}

export type CancelDecision =
  | { allowed: true; refund: 'full' }
  | { allowed: false; reason: 'inside_last_hour' | 'already_started' | 'not_paid' };

/** A participant cancels their own paid seat. */
export function participantCancellation(startsAt: Date | number, now: Date | number, rules: RulesConfig): CancelDecision {
  const t = ms(now);
  const start = ms(startsAt);
  if (t >= start) return { allowed: false, reason: 'already_started' };
  if (t >= refundDeadline(start, rules).getTime()) return { allowed: false, reason: 'inside_last_hour' };
  return { allowed: true, refund: 'full' };
}

export type RemovalDecision =
  | { allowed: true; refund: 'none' | 'full' }
  | { allowed: false; reason: 'already_started' | 'cannot_remove_host' };

/**
 * The host removes a lobby member. Unpaid members: freely. Paid members: only with a
 * full refund (and only before the start).
 */
export function hostRemoval(
  member: { paid: boolean; isHost: boolean },
  startsAt: Date | number,
  now: Date | number,
): RemovalDecision {
  if (member.isHost) return { allowed: false, reason: 'cannot_remove_host' };
  if (ms(now) >= ms(startsAt)) return { allowed: false, reason: 'already_started' };
  return { allowed: true, refund: member.paid ? 'full' : 'none' };
}

/** Joining (paying for) a seat is possible until the session starts. */
export function canJoinAt(startsAt: Date | number, now: Date | number): boolean {
  return ms(now) < ms(startsAt);
}

/** Paying now means the seat can't be refunded anymore (inside the last hour). */
export function joinIsNonRefundable(startsAt: Date | number, now: Date | number, rules: RulesConfig): boolean {
  return ms(now) >= refundDeadline(startsAt, rules).getTime();
}

export function reminderDue(startsAt: Date | number, now: Date | number, rules: RulesConfig): boolean {
  const t = ms(now);
  const start = ms(startsAt);
  return t >= start - rules.reminderBeforeMinutes * MINUTE && t < start;
}

/** True when the session should be auto-cancelled for having too few paid drivers. */
export function autoCancelDue(
  startsAt: Date | number,
  paidDrivers: number,
  now: Date | number,
  rules: RulesConfig,
): boolean {
  return ms(now) >= ms(startsAt) - rules.autoCancelBeforeMinutes * MINUTE && paidDrivers < rules.minDrivers;
}

export function checkinWindow(startsAt: Date | number, rules: RulesConfig): { opens: Date; closes: Date } {
  const start = ms(startsAt);
  return {
    opens: new Date(start - rules.checkinOpensBeforeMinutes * MINUTE),
    closes: new Date(start + rules.checkinClosesAfterMinutes * MINUTE),
  };
}

export function checkinClosed(startsAt: Date | number, now: Date | number, rules: RulesConfig): boolean {
  return ms(now) >= checkinWindow(startsAt, rules).closes.getTime();
}

export function resultsDeadline(submittedAt: Date | number, rules: RulesConfig): Date {
  return new Date(ms(submittedAt) + rules.resultsConfirmHours * HOUR);
}
