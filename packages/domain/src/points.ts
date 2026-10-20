import type { PointsConfig } from './rules.ts';

/**
 * ─────────────────────────────── POINTS FORMULA ───────────────────────────────
 *
 *   N   = number of classified drivers (no-shows are not classified)
 *   pos = finishing position (1 = winner)
 *
 *   s   = (N − pos) / (N − 1)                     1.0 for the winner … 0.0 for last
 *   m   = 1 + fieldBonus · ln(N / minFieldSize)    bigger field → bigger multiplier
 *   points = round(participation + base · s · m)
 *
 * Defaults (participation 10, base 50, fieldBonus 0.6, minFieldSize 3):
 *   win a 3-driver race ≈ 60 · win 8 drivers ≈ 89 · win 12 drivers ≈ 102 · last place = 10
 *
 * Fields smaller than minFieldSize award 0 points. All parameters are configurable
 * (DEFAULT_RULES.points / points_config table) — change them there, not here.
 * ───────────────────────────────────────────────────────────────────────────────
 */
export function pointsFor(position: number, fieldSize: number, cfg: PointsConfig): number {
  if (!Number.isInteger(position) || !Number.isInteger(fieldSize)) throw new Error('Integers required');
  if (position < 1 || position > fieldSize) throw new Error('Position out of range');
  if (fieldSize < cfg.minFieldSize) return 0;
  const s = (fieldSize - position) / (fieldSize - 1);
  const m = 1 + cfg.fieldBonus * Math.log(fieldSize / cfg.minFieldSize);
  return Math.round(cfg.participation + cfg.base * s * m);
}

/** Points table for a whole field: index 0 = winner. */
export function pointsTable(fieldSize: number, cfg: PointsConfig): number[] {
  return Array.from({ length: fieldSize }, (_, i) => pointsFor(i + 1, fieldSize, cfg));
}

/** Whether another ranked session today still counts for points. */
export function withinDailyCap(rankedSessionsToday: number, cfg: PointsConfig): boolean {
  return rankedSessionsToday < cfg.maxRankedSessionsPerDay;
}
