import { describe, expect, it } from 'vitest';
import { RANKS, XP_RULES } from '../../../config/progression.ts';
import {
  fastestLapUserIds,
  isPersonalBest,
  keepHighest,
  positionXp,
  rankIndexFor,
  rankProgress,
  sessionMeters,
  sessionXp,
  totalKm,
} from '../src/progression.ts';

const plain = { fastestLap: false, personalBest: false, newTrack: false, officialEvent: false };
const xp = (position: number, fieldSize: number, extra: Partial<typeof plain> = {}) => sessionXp({ position, fieldSize, ...plain, ...extra }, XP_RULES);
const rankKey = (km: number, points: number) => RANKS[rankIndexFor(km, points, RANKS)]!.key;

describe('XP formula', () => {
  it('position XP goes from 150 for the winner to 0 for last place', () => {
    expect(positionXp(1, 10, XP_RULES)).toBe(150);
    expect(positionXp(10, 10, XP_RULES)).toBe(0);
    expect(positionXp(4, 7, XP_RULES)).toBe(75); // 150 × 3/6
    expect(positionXp(2, 4, XP_RULES)).toBe(100); // 150 × 2/3
  });

  it('rounds position XP to the nearest whole number', () => {
    expect(positionXp(2, 8, XP_RULES)).toBe(129); // 150 × 6/7 = 128.57
    expect(positionXp(3, 8, XP_RULES)).toBe(107); // 150 × 5/7 = 107.14
  });

  it('gives 0 position XP when racing alone (N = 1)', () => {
    expect(positionXp(1, 1, XP_RULES)).toBe(0);
    expect(xp(1, 1).total).toBe(25); // participation only, no podium either
  });

  it('two drivers: the winner gets 150 position XP, no podium bonus', () => {
    expect(xp(1, 2)).toMatchObject({ position: 150, podium: 0, total: 175 });
    expect(xp(2, 2)).toMatchObject({ position: 0, podium: 0, total: 25 });
  });

  it('podium bonus only from 4 drivers', () => {
    expect(xp(1, 3).podium).toBe(0);
    expect(xp(1, 4).podium).toBe(50);
    expect(xp(2, 4).podium).toBe(30);
    expect(xp(3, 4).podium).toBe(15);
    expect(xp(4, 4).podium).toBe(0);
  });

  it('adds every bonus to the total', () => {
    // Win in a field of 8: 25 + 150 + 50 = 225
    expect(xp(1, 8).total).toBe(225);
    expect(xp(1, 8, { fastestLap: true }).total).toBe(245);
    expect(xp(1, 8, { personalBest: true }).total).toBe(240);
    expect(xp(1, 8, { newTrack: true }).total).toBe(255);
    expect(xp(1, 8, { fastestLap: true, personalBest: true, newTrack: true }).total).toBe(290);
    // Last place in a field of 8 still gets participation (and bonuses it earned).
    expect(xp(8, 8).total).toBe(25);
    expect(xp(8, 8, { newTrack: true }).total).toBe(55);
  });

  it('official events multiply the whole session total by 1.5', () => {
    const normal = xp(1, 8, { fastestLap: true });
    const event = xp(1, 8, { fastestLap: true, officialEvent: true });
    expect(normal.multiplier).toBe(1);
    expect(event.multiplier).toBe(1.5);
    expect(event.total).toBe(Math.round(245 * 1.5)); // 368 (367.5 rounds up)
    expect(xp(3, 5, { officialEvent: true }).total).toBe(Math.round((25 + 75 + 15) * 1.5)); // 173
  });

  it('returns the breakdown that adds up to the total', () => {
    const b = xp(2, 6, { fastestLap: true, newTrack: true });
    expect(b).toEqual({ participation: 25, position: 120, podium: 30, fastestLap: 20, personalBest: 0, newTrack: 30, multiplier: 1, total: 225 });
  });

  it('rejects impossible positions', () => {
    expect(() => xp(0, 5)).toThrow();
    expect(() => xp(6, 5)).toThrow();
    expect(() => xp(1.5, 5)).toThrow();
  });

  it('fastest lap goes to every driver tied on the best time', () => {
    expect(fastestLapUserIds([{ userId: 'a', bestLapMs: 48000 }, { userId: 'b', bestLapMs: 47500 }, { userId: 'c', bestLapMs: null }])).toEqual(['b']);
    expect(fastestLapUserIds([{ userId: 'a', bestLapMs: 47500 }, { userId: 'b', bestLapMs: 47500 }])).toEqual(['a', 'b']);
    expect(fastestLapUserIds([{ userId: 'a', bestLapMs: null }])).toEqual([]);
  });

  it('personal best needs an earlier lap at that track to beat', () => {
    expect(isPersonalBest(null, 47000)).toBe(false); // first visit: new-track bonus instead
    expect(isPersonalBest(48000, 47000)).toBe(true);
    expect(isPersonalBest(48000, 48000)).toBe(false);
    expect(isPersonalBest(48000, 49000)).toBe(false);
    expect(isPersonalBest(48000, null)).toBe(false);
  });
});

describe('km calculation', () => {
  it('session distance = laps × lap length', () => {
    expect(sessionMeters(12, 1240)).toBe(14880);
    expect(sessionMeters(20, 720)).toBe(14400);
    expect(sessionMeters(0, 1240)).toBe(0);
  });

  it('rejects bad input', () => {
    expect(() => sessionMeters(-1, 1000)).toThrow();
    expect(() => sessionMeters(2.5, 1000)).toThrow();
    expect(() => sessionMeters(10, 0)).toThrow();
  });

  it('total km sums sessions across all tracks', () => {
    const amc = sessionMeters(12, 1240); // 14.88 km
    const vmax = sessionMeters(14, 500); // 7 km
    expect(totalKm([amc, vmax])).toBeCloseTo(21.88, 5);
    expect(totalKm([])).toBe(0);
  });
});

describe('rank thresholds', () => {
  it('config has the 8 ranks in order, thresholds strictly increasing', () => {
    expect(RANKS.map((r) => r.name)).toEqual(['Rookie', 'Amateur', 'Club Racer', 'Contender', 'Pro', 'Apex', 'Ace', 'Veteran']);
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i]!.minKm).toBeGreaterThan(RANKS[i - 1]!.minKm);
      expect(RANKS[i]!.minXp).toBeGreaterThan(RANKS[i - 1]!.minXp);
    }
  });

  it('everyone starts as Rookie', () => {
    expect(rankKey(0, 0)).toBe('rookie');
  });

  it('reaches each rank exactly at both thresholds', () => {
    const expected: [number, number, string][] = [
      [25, 300, 'amateur'],
      [75, 1000, 'clubRacer'],
      [150, 2500, 'contender'],
      [300, 5000, 'pro'],
      [500, 9000, 'apex'],
      [800, 15000, 'ace'],
      [1200, 25000, 'veteran'],
    ];
    for (const [km, points, key] of expected) {
      expect(rankKey(km, points)).toBe(key);
      // One short on either threshold → still the rank below.
      const below = RANKS[RANKS.findIndex((r) => r.key === key) - 1]!.key;
      expect(rankKey(km - 0.001, points)).toBe(below);
      expect(rankKey(km, points - 1)).toBe(below);
    }
  });

  it('needs BOTH km and XP: lots of one is not enough', () => {
    expect(rankKey(5000, 299)).toBe('rookie'); // tons of km, not enough XP
    expect(rankKey(24.9, 100000)).toBe('rookie'); // tons of XP, not enough km
    expect(rankKey(160, 1200)).toBe('clubRacer'); // km for Contender, XP only for Club Racer
    expect(rankKey(90, 3000)).toBe('clubRacer'); // XP for Contender, km only for Club Racer
  });

  it('Veteran is the top rank', () => {
    expect(rankKey(99999, 9999999)).toBe('veteran');
    const p = rankProgress(1300, 30000, RANKS);
    expect(p.next).toBeNull();
    expect(p.kmProgress).toBe(1);
    expect(p.xpProgress).toBe(1);
  });

  it('ranks never go down (e.g. after thresholds are raised)', () => {
    expect(keepHighest(3, 1)).toBe(3);
    expect(keepHighest(1, 3)).toBe(3);
    expect(keepHighest(null, 2)).toBe(2);
    const p = rankProgress(10, 100, RANKS, 2); // stored Club Racer, numbers say Rookie
    expect(p.current.key).toBe('clubRacer');
    expect(p.kmProgress).toBe(0);
    expect(p.xpProgress).toBe(0);
  });

  it('progress shows both bars toward the next rank', () => {
    const p = rankProgress(50, 650, RANKS); // Amateur → Club Racer (75 km / 1000 XP)
    expect(p.current.key).toBe('amateur');
    expect(p.next?.key).toBe('clubRacer');
    expect(p.kmProgress).toBeCloseTo(0.5); // (50 − 25) / (75 − 25)
    expect(p.xpProgress).toBeCloseTo(0.5); // (650 − 300) / (1000 − 300)
    expect(p.kmToNext).toBe(25);
    expect(p.xpToNext).toBe(350);
  });

  it('a met threshold shows a full bar while the other one is still missing', () => {
    const p = rankProgress(80, 600, RANKS); // km already enough for Club Racer, XP not
    expect(p.current.key).toBe('amateur');
    expect(p.kmProgress).toBe(1);
    expect(p.kmToNext).toBe(0);
    expect(p.xpToNext).toBe(400);
  });
});
