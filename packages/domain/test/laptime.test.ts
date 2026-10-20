import { describe, expect, it } from 'vitest';
import { formatLapTime, parseLapTime } from '../src/laptime.ts';

describe('lap times', () => {
  it('formats', () => {
    expect(formatLapTime(61234)).toBe('1:01.234');
    expect(formatLapTime(45678)).toBe('45.678');
    expect(formatLapTime(45600)).toBe('45.600');
  });

  it('parses common inputs', () => {
    expect(parseLapTime('1:01.234')).toBe(61234);
    expect(parseLapTime('61.234')).toBe(61234);
    expect(parseLapTime('45,6')).toBe(45600);
    expect(parseLapTime(' 45 ')).toBe(45000);
  });

  it('rejects nonsense', () => {
    expect(parseLapTime('abc')).toBeNull();
    expect(parseLapTime('1:75.000')).toBeNull();
    expect(parseLapTime('2.1')).toBeNull(); // too fast
    expect(parseLapTime('11:00')).toBeNull(); // too slow
  });

  it('round-trips', () => {
    for (const ms of [5000, 33123, 59999, 61234, 125400]) {
      expect(parseLapTime(formatLapTime(ms))).toBe(ms);
    }
  });
});
