import { describe, expect, it } from '@jest/globals';
import { nextDays } from '@/lib/format';

const TZ = 'Europe/Bucharest';

describe('nextDays', () => {
  it('gives each calendar day exactly once across the October clock change (25-hour day)', () => {
    // 00:30 local time on Oct 24, 2026; clocks go back on Sunday Oct 25.
    const now = new Date('2026-10-23T21:30:00Z');
    expect(nextDays(now, TZ, 4).map((d) => d.key)).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
  });

  it('does not skip a day across the March clock change (23-hour day)', () => {
    const now = new Date('2027-03-27T22:30:00Z'); // 00:30 local on Mar 28 (clocks go forward that night)
    expect(nextDays(now, TZ, 3).map((d) => d.key)).toEqual(['2027-03-28', '2027-03-29', '2027-03-30']);
  });

  it('noon of each day is on that day in the time zone', () => {
    const days = nextDays(new Date('2026-10-23T21:30:00Z'), TZ, 3);
    for (const d of days) expect(new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d.noon)).toBe(d.key);
  });
});
