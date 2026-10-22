/**
 * Turns verified results into progression-ledger rows (km + XP). Shared by the fake
 * server (live results, approved self-reports) and the demo seed, so both score
 * exactly the same way. The formulas themselves live in @kartup/domain.
 */
import { isPersonalBest, penaltyAmount, rankIndexFor, sessionMeters, sessionXp } from '@kartup/domain';
import { RANKS, XP_RULES } from '@config/progression';
import type { PenaltyReason, ResultSource, Track } from '../types';
import type { DbLedger } from './db';

export interface VerifiedResult {
  userId: string;
  sessionId: string | null;
  track: Track;
  /** Race start, ISO. */
  date: string;
  position: number;
  fieldSize: number;
  laps: number;
  bestLapMs: number | null;
  fastestLap: boolean;
  officialEvent: boolean;
  source: ResultSource;
  verifiedBy: string | null;
  selfReportId?: string;
  /** Casual lobby: saved for history, no XP / km / rank. */
  casual?: boolean;
}

/** Rows that count for progression: Competitive / verified races (not casual, not penalties). */
export const counts = (l: DbLedger) => l.kind === 'race' && !l.casual;

const monthFormats = new Map<string, Intl.DateTimeFormat>();
const seasons = new Map<string, string>(); // formatting dates is slow; the demo seed asks thousands of times
export function seasonOf(dateIso: string, timezone: string) {
  const key = `${timezone}|${dateIso.slice(0, 13)}`; // time zones change on the hour
  let season = seasons.get(key);
  if (season) return season;
  let f = monthFormats.get(timezone);
  if (!f) monthFormats.set(timezone, (f = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' })));
  season = f.format(new Date(dateIso)).slice(0, 7);
  seasons.set(key, season);
  return season;
}

/** Score one verified result against the driver's EARLIER rows at that track (new track / personal best). */
export function scoreResult(ledger: readonly DbLedger[], r: VerifiedResult, id: string, createdAt: string): DbLedger {
  const casual = !!r.casual && !r.officialEvent;
  // Casual results never count for new-track or personal-best bonuses.
  const prior = ledger.filter((l) => counts(l) && l.userId === r.userId && l.trackId === r.track.id && l.date < r.date);
  const laps = prior.map((l) => l.bestLapMs).filter((x): x is number => !!x);
  const previousBest = laps.length ? Math.min(...laps) : null;
  const breakdown = sessionXp(
    {
      position: r.position,
      fieldSize: r.fieldSize,
      fastestLap: r.fastestLap,
      personalBest: isPersonalBest(previousBest, r.bestLapMs),
      newTrack: prior.length === 0,
      officialEvent: r.officialEvent,
    },
    XP_RULES,
  );
  return {
    id,
    kind: 'race',
    ...(casual ? { casual: true } : {}),
    userId: r.userId,
    sessionId: r.sessionId,
    trackId: r.track.id,
    cityId: r.track.cityId,
    date: r.date,
    season: seasonOf(r.date, r.track.timezone),
    position: r.position,
    fieldSize: r.fieldSize,
    laps: r.laps,
    bestLapMs: r.bestLapMs,
    meters: casual ? 0 : sessionMeters(r.laps, r.track.lapLengthM),
    xp: casual ? 0 : breakdown.total,
    breakdown: casual ? null : breakdown,
    source: r.source,
    verifiedBy: r.verifiedBy,
    ...(r.selfReportId ? { selfReportId: r.selfReportId } : {}),
    createdAt,
  };
}

export interface Totals {
  xp: number;
  meters: number;
  km: number;
  tracks: number;
  sessions: number;
  wins: number;
}

/** Totals over one driver's rows. XP includes penalties and never goes below 0. */
export function totalsOf(rows: readonly DbLedger[]): Totals {
  const meters = rows.reduce((a, l) => a + l.meters, 0);
  const races = rows.filter(counts);
  return {
    xp: Math.max(0, rows.reduce((a, l) => a + l.xp, 0)),
    meters,
    km: meters / 1000,
    tracks: new Set(races.map((l) => l.trackId)).size,
    sessions: races.length,
    wins: races.filter((l) => l.position === 1).length,
  };
}

/**
 * A behavior penalty row: minus the full amount, but never more than the driver's
 * current XP (total XP never goes below 0). It also lowers the season's XP.
 */
export function penaltyRow(
  ledger: readonly DbLedger[],
  p: { userId: string; reason: PenaltyReason; nominal: number; sessionId: string | null; track: Track; date: string },
  id: string,
  createdAt: string,
): DbLedger {
  const current = totalsOf(ledger.filter((l) => l.userId === p.userId)).xp;
  return {
    id,
    kind: 'penalty',
    penaltyReason: p.reason,
    penaltyNominal: p.nominal,
    userId: p.userId,
    sessionId: p.sessionId,
    trackId: p.track.id,
    cityId: p.track.cityId,
    date: p.date,
    season: seasonOf(p.date, p.track.timezone),
    position: 0,
    fieldSize: 0,
    laps: 0,
    bestLapMs: null,
    meters: 0,
    xp: -penaltyAmount(p.nominal, current),
    breakdown: null,
    source: 'admin',
    verifiedBy: null,
    createdAt,
  };
}

/** Rank id (1 = Rookie) the numbers alone reach. Callers keep the highest one ever reached. */
export function rankIdFor(t: Pick<Totals, 'km' | 'xp'>) {
  return rankIndexFor(t.km, t.xp, RANKS) + 1;
}
