import { describe, expect, it } from 'vitest';
import { pointsFor, pointsTable, withinDailyCap } from '../src/points.ts';
import { DEFAULT_RULES } from '../src/rules.ts';

const P = DEFAULT_RULES.points;

describe('points formula', () => {
  it('matches the documented examples', () => {
    expect(pointsFor(1, 3, P)).toBe(60);
    expect(pointsFor(1, 8, P)).toBe(89);
    expect(pointsFor(1, 12, P)).toBe(102);
    expect(pointsFor(12, 12, P)).toBe(10);
  });

  it('awards more for winning a bigger session', () => {
    expect(pointsFor(1, 10, P)).toBeGreaterThan(pointsFor(1, 5, P));
  });

  it('never increases with a worse position', () => {
    for (const n of [3, 4, 6, 10, 15]) {
      const table = pointsTable(n, P);
      for (let i = 1; i < table.length; i++) expect(table[i]!).toBeLessThanOrEqual(table[i - 1]!);
    }
  });

  it('gives nothing below the minimum field size', () => {
    expect(pointsFor(1, 2, P)).toBe(0);
  });

  it('rejects invalid positions', () => {
    expect(() => pointsFor(0, 5, P)).toThrow();
    expect(() => pointsFor(6, 5, P)).toThrow();
  });

  it('enforces the daily cap', () => {
    expect(withinDailyCap(2, P)).toBe(true);
    expect(withinDailyCap(3, P)).toBe(false);
  });
});
