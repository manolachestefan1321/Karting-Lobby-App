import { describe, expect, it } from 'vitest';
import { ageOn, isOldEnough, parseIsoDate, todayInZone } from '../src/age.ts';

describe('age', () => {
  it('counts full years only after the birthday', () => {
    expect(ageOn('2010-05-20', '2026-05-19')).toBe(15);
    expect(ageOn('2010-05-20', '2026-05-20')).toBe(16);
  });

  it('handles 29 February birthdays', () => {
    expect(ageOn('2008-02-29', '2024-02-28')).toBe(15);
    expect(ageOn('2008-02-29', '2024-02-29')).toBe(16);
    expect(ageOn('2008-02-29', '2025-03-01')).toBe(17);
  });

  it('rejects impossible dates', () => {
    expect(parseIsoDate('2023-02-29')).toBeNull();
    expect(parseIsoDate('2023-13-01')).toBeNull();
    expect(parseIsoDate('20-01-01')).toBeNull();
  });

  it('uses the calendar date of the given time zone', () => {
    // 22:30 UTC on 19 May is already 20 May in Bucharest (UTC+3 in summer).
    const now = new Date('2026-05-19T22:30:00Z');
    expect(todayInZone(now, 'Europe/Bucharest')).toBe('2026-05-20');
    expect(isOldEnough('2010-05-20', 16, now, 'Europe/Bucharest')).toBe(true);
    expect(isOldEnough('2010-05-20', 16, now, 'UTC')).toBe(false);
  });
});
