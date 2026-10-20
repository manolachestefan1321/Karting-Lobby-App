import { describe, expect, it } from 'vitest';
import { activeBan, banForNewNoShow, banMinutesForOffense } from '../src/bans.ts';
import { DEFAULT_RULES, HOUR, MINUTE } from '../src/rules.ts';

const L = DEFAULT_RULES.banLadder;

describe('ban ladder', () => {
  it('escalates 1h → 24h → 7d → 30d', () => {
    expect(banMinutesForOffense(1, L)).toBe(60);
    expect(banMinutesForOffense(2, L)).toBe(24 * 60);
    expect(banMinutesForOffense(3, L)).toBe(7 * 24 * 60);
    expect(banMinutesForOffense(4, L)).toBe(30 * 24 * 60);
  });

  it('keeps the last step for 5th and later offenses', () => {
    expect(banMinutesForOffense(5, L)).toBe(30 * 24 * 60);
    expect(banMinutesForOffense(42, L)).toBe(30 * 24 * 60);
  });

  it('uses whatever ladder is configured', () => {
    const custom = [
      { offense: 1, minutes: 10 },
      { offense: 3, minutes: 100 },
    ];
    expect(banMinutesForOffense(2, custom)).toBe(10);
    expect(banMinutesForOffense(3, custom)).toBe(100);
  });

  it('computes start and end of a new ban', () => {
    const now = new Date('2026-11-01T18:15:00Z');
    const ban = banForNewNoShow(1, now, L);
    expect(ban.offense).toBe(2);
    expect(ban.endsAt.toISOString()).toBe('2026-11-02T18:15:00.000Z');
  });
});

describe('active ban', () => {
  const t0 = new Date('2026-11-01T12:00:00Z').getTime();
  const bans = [
    { id: 'a', startsAt: t0, endsAt: t0 + HOUR },
    { id: 'b', startsAt: t0, endsAt: t0 + 24 * HOUR },
  ];
  it('returns the longest running ban', () => {
    expect(activeBan(bans, t0 + 30 * MINUTE)?.id).toBe('b');
  });
  it('ignores expired and lifted bans', () => {
    expect(activeBan(bans, t0 + 25 * HOUR)).toBeNull();
    expect(activeBan([{ ...bans[1]!, liftedAt: t0 + MINUTE }], t0 + 2 * MINUTE)).toBeNull();
  });
  it('treats endsAt = null as permanent', () => {
    expect(activeBan([{ startsAt: t0, endsAt: null }], t0 + 1000 * HOUR)).not.toBeNull();
  });
});
