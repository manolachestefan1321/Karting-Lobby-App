/**
 * ───────────────────────────── RANK PROGRESSION ─────────────────────────────
 *
 * Distance:  session meters = laps completed × track lap length (m)
 *            total km       = sum over every verified session, all tracks
 *
 * XP for one verified session (N = classified drivers, pos = finishing position):
 *   participation                      +25
 *   position     round(150 × (N − pos) / (N − 1))      (0 when N = 1)
 *   podium       P1 +50 · P2 +30 · P3 +15              (only when N ≥ 4)
 *   fastest lap of the session         +20
 *   new personal best at that track    +15
 *   first session at a new track       +30             (once per track)
 *   official KartUP event              total × 1.5
 *
 * Rank = the highest rank whose km AND XP thresholds are both met. Ranks never
 * go down: callers keep the highest rank reached (see `keepHighest`).
 *
 * All numbers come from config/progression.ts and are passed in, so they can be
 * changed without touching this file.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface XpRules {
  participation: number;
  positionMax: number;
  podium: readonly number[];
  podiumMinField: number;
  fastestLap: number;
  personalBest: number;
  newTrack: number;
  officialEventMultiplier: number;
}

export interface RankThreshold {
  key: string;
  minKm: number;
  minXp: number;
}

export interface SessionXpInput {
  position: number;
  fieldSize: number;
  fastestLap: boolean;
  personalBest: boolean;
  newTrack: boolean;
  officialEvent: boolean;
}

export interface XpBreakdown {
  participation: number;
  position: number;
  podium: number;
  fastestLap: number;
  personalBest: number;
  newTrack: number;
  /** 1, or the official-event multiplier. */
  multiplier: number;
  total: number;
}

/** Position XP: full for the winner, 0 for last place, 0 when racing alone. */
export function positionXp(position: number, fieldSize: number, rules: XpRules): number {
  if (!Number.isInteger(position) || !Number.isInteger(fieldSize)) throw new Error('Integers required');
  if (fieldSize < 1 || position < 1 || position > fieldSize) throw new Error('Position out of range');
  if (fieldSize === 1) return 0;
  return Math.round((rules.positionMax * (fieldSize - position)) / (fieldSize - 1));
}

export function podiumXp(position: number, fieldSize: number, rules: XpRules): number {
  if (fieldSize < rules.podiumMinField) return 0;
  return rules.podium[position - 1] ?? 0;
}

export function sessionXp(input: SessionXpInput, rules: XpRules): XpBreakdown {
  const parts = {
    participation: rules.participation,
    position: positionXp(input.position, input.fieldSize, rules),
    podium: podiumXp(input.position, input.fieldSize, rules),
    fastestLap: input.fastestLap ? rules.fastestLap : 0,
    personalBest: input.personalBest ? rules.personalBest : 0,
    newTrack: input.newTrack ? rules.newTrack : 0,
  };
  const multiplier = input.officialEvent ? rules.officialEventMultiplier : 1;
  const sum = parts.participation + parts.position + parts.podium + parts.fastestLap + parts.personalBest + parts.newTrack;
  return { ...parts, multiplier, total: Math.round(sum * multiplier) };
}

/** Distance of one session in meters. */
export function sessionMeters(laps: number, lapLengthM: number): number {
  if (!Number.isInteger(laps) || laps < 0) throw new Error('Laps must be a whole number ≥ 0');
  if (!(lapLengthM > 0)) throw new Error('Lap length must be positive');
  return Math.round(laps * lapLengthM);
}

/** Total kilometers from a list of session distances in meters. */
export function totalKm(sessionMetersList: readonly number[]): number {
  return sessionMetersList.reduce((a, m) => a + m, 0) / 1000;
}

/** Drivers who set the session's fastest lap (several when tied). Entries without a lap time are ignored. */
export function fastestLapUserIds(entries: readonly { userId: string; bestLapMs?: number | null }[]): string[] {
  const timed = entries.filter((e): e is { userId: string; bestLapMs: number } => typeof e.bestLapMs === 'number' && e.bestLapMs > 0);
  if (timed.length === 0) return [];
  const best = Math.min(...timed.map((e) => e.bestLapMs));
  return timed.filter((e) => e.bestLapMs === best).map((e) => e.userId);
}

/** A new personal best needs an earlier best lap at the same track to beat. */
export function isPersonalBest(previousBestMs: number | null | undefined, lapMs: number | null | undefined): boolean {
  return !!previousBestMs && !!lapMs && lapMs < previousBestMs;
}

/** Index (0-based) of the highest rank whose km AND XP thresholds are both met. Ranks must be sorted lowest first. */
export function rankIndexFor(km: number, xp: number, ranks: readonly RankThreshold[]): number {
  if (ranks.length === 0) throw new Error('No ranks configured');
  let index = 0;
  for (let i = 0; i < ranks.length; i++) if (km >= ranks[i]!.minKm && xp >= ranks[i]!.minXp) index = i;
  return index;
}

/** Ranks are permanent: never return a lower rank than the one already reached. */
export function keepHighest(storedIndex: number | null | undefined, computedIndex: number): number {
  return Math.max(storedIndex ?? 0, computedIndex);
}

export interface RankProgress<T extends RankThreshold> {
  index: number;
  current: T;
  next: T | null;
  /** 0..1 from the current rank's threshold to the next one (1 at the top rank). */
  kmProgress: number;
  xpProgress: number;
  kmToNext: number;
  xpToNext: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function rankProgress<T extends RankThreshold>(km: number, xp: number, ranks: readonly T[], storedIndex?: number | null): RankProgress<T> {
  const index = keepHighest(storedIndex, rankIndexFor(km, xp, ranks));
  const current = ranks[index]!;
  const next = ranks[index + 1] ?? null;
  if (!next) return { index, current, next: null, kmProgress: 1, xpProgress: 1, kmToNext: 0, xpToNext: 0 };
  return {
    index,
    current,
    next,
    kmProgress: clamp01((km - current.minKm) / (next.minKm - current.minKm)),
    xpProgress: clamp01((xp - current.minXp) / (next.minXp - current.minXp)),
    kmToNext: Math.max(0, Math.round((next.minKm - km) * 10) / 10),
    xpToNext: Math.max(0, next.minXp - xp),
  };
}

// ───────────────────────────── lobby type & penalties ─────────────────────────────

/** Competitive lobbies count for XP / km / rank; casual ones are history only. Official events are always competitive. */
export type LobbyType = 'casual' | 'competitive';

export function effectiveLobbyType(lobbyType: LobbyType, officialEvent: boolean): LobbyType {
  return officialEvent ? 'competitive' : lobbyType;
}

/**
 * XP actually taken by a penalty: the full amount, but never more than the driver
 * has, so total XP never goes below 0. Returns a positive number (subtract it).
 */
export function penaltyAmount(nominal: number, currentTotalXp: number): number {
  if (!(nominal >= 0)) throw new Error('Penalty must be ≥ 0');
  return Math.max(0, Math.min(nominal, currentTotalXp));
}

/** Leaving a paid seat inside this window before the start costs XP (Competitive only). */
export function isLateLeave(startsAt: Date | number, now: Date | number, windowMinutes: number): boolean {
  const s = typeof startsAt === 'number' ? startsAt : startsAt.getTime();
  const n = typeof now === 'number' ? now : now.getTime();
  return n < s && s - n < windowMinutes * 60_000;
}
