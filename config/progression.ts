/**
 * Rank progression — the ONLY place to rename ranks or rebalance thresholds and XP.
 * The rules that use these numbers live in packages/domain/src/progression.ts and
 * never need to change when you edit this file.
 *
 * A driver reaches a rank only when BOTH thresholds are met (km AND XP).
 * Ranks are permanent: the highest rank reached is stored and never goes down,
 * even if the thresholds below are raised later.
 *
 * Rank names are the same in every language (they are not translated).
 * Order matters: lowest rank first. The position in this list is the rank's id (1 = first).
 */
export const RANKS = [
  { key: 'rookie', name: 'Rookie', minKm: 0, minXp: 0, color: '#8A8F98' },
  { key: 'amateur', name: 'Amateur', minKm: 25, minXp: 300, color: '#3FA34D' },
  { key: 'clubRacer', name: 'Club Racer', minKm: 75, minXp: 1000, color: '#2F7DE1' },
  { key: 'contender', name: 'Contender', minKm: 150, minXp: 2500, color: '#0E9AA7' },
  { key: 'pro', name: 'Pro', minKm: 300, minXp: 5000, color: '#9B51E0' },
  { key: 'apex', name: 'Apex', minKm: 500, minXp: 9000, color: '#E8762C' },
  { key: 'ace', name: 'Ace', minKm: 800, minXp: 15000, color: '#C9A227' },
  { key: 'veteran', name: 'Veteran', minKm: 1200, minXp: 25000, color: '#E10600' },
] as const;

export type RankKey = (typeof RANKS)[number]['key'];

/** XP awarded per VERIFIED session. Self-reported results give nothing until an admin approves them. */
export const XP_RULES = {
  /** Every classified driver, just for racing. */
  participation: 25,
  /** Winner's position XP; scaled down to 0 for last place: round(150 × (N − pos) / (N − 1)). */
  positionMax: 150,
  /** Podium bonus for P1, P2, P3 … */
  podium: [50, 30, 15],
  /** … only when at least this many drivers were classified. */
  podiumMinField: 4,
  /** Fastest lap of the session (shared if tied). */
  fastestLap: 20,
  /** Beat your own previous best lap at that track. */
  personalBest: 15,
  /** First verified session at a track (once per track). */
  newTrack: 30,
  /** Official KartUP events: the session's total XP is multiplied by this. */
  officialEventMultiplier: 1.5,
};
