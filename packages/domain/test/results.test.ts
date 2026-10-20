import { describe, expect, it } from 'vitest';
import { resultsStatus, validateFinishingOrder } from '../src/results.ts';

const attended = ['a', 'b', 'c'];

describe('finishing order validation', () => {
  it('accepts a full permutation', () => {
    expect(validateFinishingOrder([{ userId: 'b', position: 1 }, { userId: 'a', position: 2 }, { userId: 'c', position: 3 }], attended)).toEqual({ ok: true });
  });
  it('rejects missing, unknown and duplicate drivers', () => {
    expect(validateFinishingOrder([{ userId: 'a', position: 1 }, { userId: 'b', position: 2 }], attended)).toEqual({ ok: false, reason: 'missing_driver' });
    expect(validateFinishingOrder([{ userId: 'a', position: 1 }, { userId: 'b', position: 2 }, { userId: 'x', position: 3 }], attended)).toEqual({ ok: false, reason: 'unknown_driver' });
    expect(validateFinishingOrder([{ userId: 'a', position: 1 }, { userId: 'a', position: 2 }, { userId: 'c', position: 3 }], attended)).toEqual({ ok: false, reason: 'duplicate_driver' });
  });
  it('rejects gaps or shared positions', () => {
    expect(validateFinishingOrder([{ userId: 'a', position: 1 }, { userId: 'b', position: 1 }, { userId: 'c', position: 3 }], attended)).toEqual({ ok: false, reason: 'bad_positions' });
  });
});

describe('results confirmation', () => {
  const deadline = new Date('2026-11-02T18:00:00Z');
  const before = new Date('2026-11-02T10:00:00Z');
  const after = new Date('2026-11-02T18:00:00Z');
  const respondents = ['b', 'c'];

  it('stays pending within 24h without everyone confirming', () => {
    expect(resultsStatus({ responses: [{ userId: 'b', response: 'confirm' }], respondents, deadline, now: before })).toBe('pending');
  });
  it('becomes final early when everyone confirmed', () => {
    expect(resultsStatus({ responses: [{ userId: 'b', response: 'confirm' }, { userId: 'c', response: 'confirm' }], respondents, deadline, now: before })).toBe('final');
  });
  it('becomes final automatically after the deadline if undisputed', () => {
    expect(resultsStatus({ responses: [], respondents, deadline, now: after })).toBe('final');
  });
  it('any dispute sends it to admin review, even after the deadline', () => {
    expect(resultsStatus({ responses: [{ userId: 'c', response: 'dispute' }], respondents, deadline, now: after })).toBe('disputed');
  });
  it('admin decision wins', () => {
    expect(resultsStatus({ responses: [{ userId: 'c', response: 'dispute' }], respondents, deadline, now: before, adminDecision: 'approved' })).toBe('final');
    expect(resultsStatus({ responses: [], respondents, deadline, now: before, adminDecision: 'rejected' })).toBe('rejected');
  });
});
