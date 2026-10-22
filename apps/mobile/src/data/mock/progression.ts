/**
 * Turns verified results into progression-ledger rows (km + XP). Shared by the fake
 * server (live results, approved self-reports) and the demo seed, so both score
 * exactly the same way. The formulas themselves live in @kartup/domain.
 */
import { isPersonalBest, rankIndexFor, sessionMeters, sessionXp } from '@kartup/domain';
import { RANKS, XP_RULES } from '@config/progression';
import type { ResultSource, Track } from '../types';
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
}

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
  const prior = ledger.filter((l) => l.userId === r.userId && l.trackId === r.track.id && l.date < r.date);
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
    meters: sessionMeters(r.laps, r.track.lapLengthM),
    xp: breakdown.total,
    breakdown,
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

export function totalsOf(rows: readonly DbLedger[]): Totals {
  const meters = rows.reduce((a, l) => a + l.meters, 0);
  return {
    xp: rows.reduce((a, l) => a + l.xp, 0),
    meters,
    km: meters / 1000,
    tracks: new Set(rows.map((l) => l.trackId)).size,
    sessions: rows.length,
    wins: rows.filter((l) => l.position === 1).length,
  };
}

/** Rank id (1 = Rookie) the numbers alone reach. Callers keep the highest one ever reached. */
export function rankIdFor(t: Pick<Totals, 'km' | 'xp'>) {
  return rankIndexFor(t.km, t.xp, RANKS) + 1;
}
