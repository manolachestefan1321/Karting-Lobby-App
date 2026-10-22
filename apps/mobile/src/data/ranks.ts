import { RANKS } from '@config/progression';
import type { RankTier } from './types';

/** The 8 ranks from config/progression.ts, with ids (1 = Rookie). Used by both backends. */
export const RANK_TIERS: RankTier[] = RANKS.map((r, i) => ({ id: i + 1, ...r }));

export function rankById(id: number | null | undefined): RankTier | undefined {
  return id ? RANK_TIERS[id - 1] : undefined;
}
