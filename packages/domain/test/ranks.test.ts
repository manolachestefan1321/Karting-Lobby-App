import { describe, expect, it } from 'vitest';
import { rankProgress } from '../src/ranks.ts';

const tiers = [
  { id: 3, key: 'clubRacer', min_points: 1000 },
  { id: 1, key: 'rookie', min_points: 0 },
  { id: 2, key: 'amateur', min_points: 250 },
];

describe('rankProgress', () => {
  it('starts at the lowest tier', () => {
    const r = rankProgress(0, tiers);
    expect(r.current.key).toBe('rookie');
    expect(r.next?.key).toBe('amateur');
    expect(r.progress).toBe(0);
    expect(r.pointsToNext).toBe(250);
  });

  it('computes progress between thresholds', () => {
    const r = rankProgress(625, tiers);
    expect(r.current.key).toBe('amateur');
    expect(r.progress).toBeCloseTo(0.5);
    expect(r.pointsToNext).toBe(375);
  });

  it('reaches a tier exactly at its threshold', () => {
    expect(rankProgress(250, tiers).current.key).toBe('amateur');
  });

  it('reports the top tier as complete', () => {
    const r = rankProgress(5000, tiers);
    expect(r.current.key).toBe('clubRacer');
    expect(r.next).toBeNull();
    expect(r.progress).toBe(1);
  });

  it('treats negative points as zero', () => {
    expect(rankProgress(-20, tiers).current.key).toBe('rookie');
  });
});
