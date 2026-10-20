import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES as R, HOUR, MINUTE } from '../src/rules.ts';
import {
  autoCancelDue,
  canJoinAt,
  hostRemoval,
  joinIsNonRefundable,
  participantCancellation,
  reminderDue,
  sessionPhase,
} from '../src/timeline.ts';

const start = new Date('2026-11-01T16:00:00Z').getTime();

describe('refund rules (cancel by participant)', () => {
  it('full refund until exactly 1 hour before start', () => {
    expect(participantCancellation(start, start - 2 * HOUR, R)).toEqual({ allowed: true, refund: 'full' });
    expect(participantCancellation(start, start - HOUR - 1, R)).toEqual({ allowed: true, refund: 'full' });
  });

  it('cancellation disabled inside the last hour (no refund)', () => {
    expect(participantCancellation(start, start - HOUR, R)).toEqual({ allowed: false, reason: 'inside_last_hour' });
    expect(participantCancellation(start, start - 5 * MINUTE, R)).toEqual({ allowed: false, reason: 'inside_last_hour' });
  });

  it('cannot cancel after the start', () => {
    expect(participantCancellation(start, start + MINUTE, R)).toEqual({ allowed: false, reason: 'already_started' });
  });

  it('respects a different configured cutoff', () => {
    const rules = { ...R, cancelRefundCutoffMinutes: 120 };
    expect(participantCancellation(start, start - 90 * MINUTE, rules).allowed).toBe(false);
  });
});

describe('host removing members', () => {
  it('unpaid members are removed without refund', () => {
    expect(hostRemoval({ paid: false, isHost: false }, start, start - HOUR)).toEqual({ allowed: true, refund: 'none' });
  });
  it('paid members only with a full refund — even inside the last hour', () => {
    expect(hostRemoval({ paid: true, isHost: false }, start, start - 10 * MINUTE)).toEqual({ allowed: true, refund: 'full' });
  });
  it('not after start, and never the host', () => {
    expect(hostRemoval({ paid: true, isHost: false }, start, start + 1)).toEqual({ allowed: false, reason: 'already_started' });
    expect(hostRemoval({ paid: true, isHost: true }, start, start - HOUR)).toEqual({ allowed: false, reason: 'cannot_remove_host' });
  });
});

describe('joining', () => {
  it('allowed until start, non-refundable inside the last hour', () => {
    expect(canJoinAt(start, start - 1)).toBe(true);
    expect(canJoinAt(start, start)).toBe(false);
    expect(joinIsNonRefundable(start, start - 2 * HOUR, R)).toBe(false);
    expect(joinIsNonRefundable(start, start - 30 * MINUTE, R)).toBe(true);
  });
});

describe('reminders and auto-cancel', () => {
  it('reminder is due from 2 hours before start', () => {
    expect(reminderDue(start, start - 2 * HOUR - 1, R)).toBe(false);
    expect(reminderDue(start, start - 2 * HOUR, R)).toBe(true);
    expect(reminderDue(start, start + 1, R)).toBe(false);
  });

  it('auto-cancels with fewer than 4 paid drivers from 3 hours before start', () => {
    expect(autoCancelDue(start, 3, start - 4 * HOUR, R)).toBe(false);
    expect(autoCancelDue(start, 3, start - 3 * HOUR, R)).toBe(true);
    expect(autoCancelDue(start, 4, start - 3 * HOUR, R)).toBe(false);
  });
});

describe('session phases', () => {
  const s = { startsAt: start, cancelled: false };
  it('moves through open → locked → check-in → awaiting results', () => {
    expect(sessionPhase(s, start - 2 * HOUR, R)).toBe('open');
    expect(sessionPhase(s, start - 45 * MINUTE, R)).toBe('locked');
    expect(sessionPhase(s, start - 30 * MINUTE, R)).toBe('checkin');
    expect(sessionPhase(s, start + 14 * MINUTE, R)).toBe('checkin');
    expect(sessionPhase(s, start + 15 * MINUTE, R)).toBe('awaiting_results');
  });
  it('results and cancellation override time', () => {
    expect(sessionPhase({ ...s, cancelled: true }, start - 2 * HOUR, R)).toBe('cancelled');
    expect(sessionPhase({ ...s, resultsStatus: 'pending' }, start + HOUR, R)).toBe('results_pending');
    expect(sessionPhase({ ...s, resultsStatus: 'final' }, start + HOUR, R)).toBe('final');
  });
});
