/**
 * Rank tiers are configured in the database (table rank_tiers). These helpers
 * work on whatever tiers are passed in, so changing tiers needs no code change.
 */
export interface RankTierLike {
  id: number;
  key: string;
  min_points: number;
}

export interface RankProgress<T extends RankTierLike> {
  current: T;
  next: T | null;
  /** 0..1 progress from the current tier threshold to the next one (1 when at top rank). */
  progress: number;
  pointsToNext: number;
}

export function rankProgress<T extends RankTierLike>(points: number, tiers: readonly T[]): RankProgress<T> {
  if (tiers.length === 0) throw new Error('No rank tiers configured');
  const sorted = [...tiers].sort((a, b) => a.min_points - b.min_points);
  const safePoints = Math.max(0, points);
  let index = 0;
  for (let i = 0; i < sorted.length; i++) if (sorted[i]!.min_points <= safePoints) index = i;
  const current = sorted[index]!;
  const next = sorted[index + 1] ?? null;
  if (!next) return { current, next: null, progress: 1, pointsToNext: 0 };
  const span = next.min_points - current.min_points;
  return {
    current,
    next,
    progress: Math.min(1, (safePoints - current.min_points) / span),
    pointsToNext: next.min_points - safePoints,
  };
}
