import { describe, expect, it } from 'vitest';
import { checkinDecision, distanceMeters, isNoShow } from '../src/checkin.ts';
import { DEFAULT_RULES as R, MINUTE } from '../src/rules.ts';

const track = { lat: 44.4268, lng: 26.1025 };
const start = new Date('2026-11-01T16:00:00Z').getTime();
const near = { lat: 44.4278, lng: 26.1025 }; // ~111 m north

describe('check-in', () => {
  it('measures distance', () => {
    expect(Math.round(distanceMeters(track, near))).toBe(111);
  });
  it('opens 30 min before and closes 15 min after start', () => {
    const base = { startsAt: start, position: near, track, paid: true, rules: R };
    expect(checkinDecision({ ...base, now: start - 31 * MINUTE })).toEqual({ ok: false, reason: 'too_early' });
    expect(checkinDecision({ ...base, now: start - 30 * MINUTE }).ok).toBe(true);
    expect(checkinDecision({ ...base, now: start + 14 * MINUTE }).ok).toBe(true);
    expect(checkinDecision({ ...base, now: start + 15 * MINUTE })).toEqual({ ok: false, reason: 'too_late' });
  });
  it('requires being within the radius', () => {
    const far = { lat: 44.44, lng: 26.1025 };
    const r = checkinDecision({ startsAt: start, now: start, position: far, track, paid: true, rules: R });
    expect(r.ok).toBe(false);
    expect(checkinDecision({ startsAt: start, now: start, position: far, track, paid: true, rules: R, radiusMeters: 5000 }).ok).toBe(true);
  });
  it('only for paid participants', () => {
    expect(checkinDecision({ startsAt: start, now: start, position: near, track, paid: false, rules: R })).toEqual({ ok: false, reason: 'not_paid' });
  });
});

describe('no-show', () => {
  it('paid + no check-in + not confirmed by host', () => {
    expect(isNoShow({ paid: true, checkedIn: false, hostConfirmed: false })).toBe(true);
    expect(isNoShow({ paid: true, checkedIn: false, hostConfirmed: true })).toBe(false);
    expect(isNoShow({ paid: true, checkedIn: true, hostConfirmed: false })).toBe(false);
    expect(isNoShow({ paid: false, checkedIn: false, hostConfirmed: false })).toBe(false);
  });
});
