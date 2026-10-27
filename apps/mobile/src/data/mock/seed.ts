/**
 * Fictional but realistic demo data for the web preview. Every person, track and
 * price here is made up. Times are generated relative to "now" so the scenarios
 * (session in 45 min, results waiting, …) always make sense when you reset.
 */
import { DEFAULT_RULES, fastestLapUserIds, sessionXp } from '@kartup/domain';
import { PENALTIES, RANKS, XP_RULES } from '@config/progression';
import type { City, NotificationPrefs } from '../types';
import { REAL_TRACKS } from './tracks';
import { localDateKey, zonedToUtc } from '@/lib/format';
import { DB_VERSION, type Db, type DbExperience, type DbLedger, type DbMember, type DbPayment, type DbResults, type DbSession, type DbUser } from './db';
import { counts, penaltyRow, rankIdFor, scoreResult, totalsOf, type VerifiedResult } from './progression';

export const TEST_PASSWORD = 'kartup123';
export const TEST_EMAIL = 'andrei@kartup.test';
export const TEST_USER_ID = 'u-andrei';
/** Demo admin: approves self-reported results, marks official events. */
export const ADMIN_EMAIL = 'admin@kartup.test';
export const ADMIN_USER_ID = 'u-admin';

/**
 * DEMO ONLY — the rank each fake driver ends up in (index into RANKS: 0 = Rookie …
 * 7 = Veteran), so every rank is visible in the demo. This never reaches the real
 * database: the real seed (supabase/seed.sql) has no users or results.
 */
export const TARGET_RANK: Record<string, number> = {
  [TEST_USER_ID]: 2, // Club Racer, just below Contender: finishing one session ranks him up
  'u-cristian': 7,
  'u-radu': 6,
  'u-vlad': 5,
  'u-maria': 4,
  'u-mihai': 4,
  'u-ana': 3,
  'u-stefan': 3,
  'u-larisa': 3,
  'u-elena': 2,
  'u-alex': 2,
  'u-paul': 2,
  'u-sorin': 2,
  'u-bianca': 1,
  'u-diana': 1,
  'u-gabriel': 1,
  'u-raluca': 1,
  'u-bogdan': 0,
  'u-teodora': 0,
  'u-ioana': 0,
};

/**
 * Andrei sits just below Contender (150 km / 2,500 XP) on BOTH: any finish in a
 * waiting session (≥ 2 laps, ≥ 25 XP) crosses both thresholds → rank-up celebration.
 */
const ANDREI_WINDOW: [{ km: number; xp: number }, { km: number; xp: number }] = [
  { km: 148.65, xp: 2476 },
  { km: 149.6, xp: 2496 },
];

/** Range of lifetime km / XP a demo driver is generated into (inside their target rank). */
function targetWindow(userId: string): [{ km: number; xp: number }, { km: number; xp: number }] {
  if (userId === TEST_USER_ID) return ANDREI_WINDOW;
  const k = TARGET_RANK[userId] ?? 0;
  if (userId === 'u-ioana' || userId === ADMIN_USER_ID || !(userId in TARGET_RANK)) return [{ km: 0, xp: 0 }, { km: 0, xp: 0 }]; // brand new
  if (k === 0) return [{ km: 4, xp: 60 }, { km: 20, xp: 280 }];
  const cur = RANKS[k]!;
  const next = RANKS[k + 1];
  if (!next) return [{ km: cur.minKm + 50, xp: cur.minXp + 1000 }, { km: cur.minKm + 250, xp: cur.minXp + 5000 }];
  const at = (f: number) => ({ km: cur.minKm + f * (next.minKm - cur.minKm), xp: Math.round(cur.minXp + f * (next.minXp - cur.minXp)) });
  return [at(0.25), at(0.75)];
}

/** Scores a driver's results in date order (new-track and personal-best bonuses depend on order). */
function scoreAll(list: readonly VerifiedResult[]): DbLedger[] {
  const out: DbLedger[] = [];
  for (const v of [...list].sort((a, b) => a.date.localeCompare(b.date))) out.push(scoreResult(out, v, '', v.date));
  return out;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Small deterministic PRNG so the demo data is the same after every reset. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cities: City[] = [
  { id: 'c-buc', name: 'București', slug: 'bucuresti', countryCode: 'RO', timezone: 'Europe/Bucharest', lat: 44.4268, lng: 26.1025 },
  { id: 'c-cj', name: 'Cluj-Napoca', slug: 'cluj-napoca', countryCode: 'RO', timezone: 'Europe/Bucharest', lat: 46.7712, lng: 23.6236 },
  { id: 'c-tm', name: 'Timișoara', slug: 'timisoara', countryCode: 'RO', timezone: 'Europe/Bucharest', lat: 45.7489, lng: 21.2087 },
  { id: 'c-is', name: 'Iași', slug: 'iasi', countryCode: 'RO', timezone: 'Europe/Bucharest', lat: 47.1585, lng: 27.6014 },
  { id: 'c-ct', name: 'Constanța', slug: 'constanta', countryCode: 'RO', timezone: 'Europe/Bucharest', lat: 44.1598, lng: 28.6348 },
  { id: 'c-bv', name: 'Brașov', slug: 'brasov', countryCode: 'RO', timezone: 'Europe/Bucharest', lat: 45.6427, lng: 25.5887 },
  { id: 'c-cv', name: 'Craiova', slug: 'craiova', countryCode: 'RO', timezone: 'Europe/Bucharest', lat: 44.3302, lng: 23.7949 },
  { id: 'c-or', name: 'Oradea', slug: 'oradea', countryCode: 'RO', timezone: 'Europe/Bucharest', lat: 47.0465, lng: 21.9189 },
];

const PEOPLE: [string, string, string, string, string][] = [
  // id, first, last, city, date of birth
  [TEST_USER_ID, 'Andrei', 'Popescu', 'c-buc', '1996-03-14'],
  ['u-maria', 'Maria', 'Ionescu', 'c-buc', '1994-07-02'],
  ['u-radu', 'Radu', 'Dumitrescu', 'c-buc', '1989-11-23'],
  ['u-elena', 'Elena', 'Stan', 'c-buc', '1999-01-30'],
  ['u-mihai', 'Mihai', 'Georgescu', 'c-buc', '1992-05-17'],
  ['u-ioana', 'Ioana', 'Marin', 'c-buc', '2001-09-09'],
  ['u-vlad', 'Vlad', 'Constantin', 'c-buc', '1990-12-01'],
  ['u-ana', 'Ana', 'Dobre', 'c-buc', '1997-04-21'],
  ['u-cristian', 'Cristian', 'Tudor', 'c-buc', '1986-08-11'],
  ['u-bianca', 'Bianca', 'Florea', 'c-buc', '2003-02-14'],
  ['u-alex', 'Alexandru', 'Munteanu', 'c-buc', '1995-10-05'],
  ['u-diana', 'Diana', 'Nistor', 'c-buc', '1998-06-27'],
  ['u-bogdan', 'Bogdan', 'Rusu', 'c-buc', '1993-03-03'],
  ['u-larisa', 'Larisa', 'Moldovan', 'c-cj', '1996-09-19'],
  ['u-paul', 'Paul', 'Matei', 'c-cj', '1991-01-08'],
  ['u-sorin', 'Sorin', 'Barbu', 'c-tm', '1988-07-15'],
  ['u-teodora', 'Teodora', 'Lazăr', 'c-ct', '2000-11-11'],
  ['u-gabriel', 'Gabriel', 'Ene', 'c-is', '1994-02-02'],
  ['u-raluca', 'Raluca', 'Pavel', 'c-bv', '1997-12-24'],
  ['u-stefan', 'Ștefan', 'Oprea', 'c-buc', '1999-05-05'],
  [ADMIN_USER_ID, 'Irina', 'Vasile', 'c-buc', '1990-04-12'],
];

const BIOS = [
  'Weekend racer, chasing a sub-50 at VMax Romexpo.',
  'Late braker. Early apologizer.',
  'Former rental-kart champion of my office.',
  'Here for the fun and the overtakes.',
  'Learning the racing line one session at a time.',
  'Outdoor tracks only, rain or shine.',
  '',
];

const CHAT = [
  'Anyone up for a second session after?',
  'I can bring a GoPro 🎥',
  'See you at the track!',
  'Parking is behind the main building.',
  'Who is taking pole today? 😄',
  'Running 5 min late, sorry!',
  'Let’s do a rolling start this time.',
];

export const DEFAULT_PREFS: NotificationPrefs = { lobby: true, chat: true, reminders: true, results: true, ranking: true, account: true };

export function seed(realNow: number): Db {
  const r = rng(20261020);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)]!;
  // Round "now" to the next quarter hour so session times look natural.
  const now = Math.ceil(realNow / (15 * MIN)) * 15 * MIN;
  const iso = (t: number) => new Date(t).toISOString();
  const tracks = REAL_TRACKS;
  /** A plausible opening-hours start time: `days` from now at HH:MM Bucharest time. */
  const atLocal = (days: number, time: string) => zonedToUtc(localDateKey(new Date(now + days * DAY), 'Europe/Bucharest'), time, 'Europe/Bucharest').getTime();
  const trackById = new Map(tracks.map((t) => [t.id, t]));
  let seq = 1;
  const id = (p: string) => `${p}-${seq++}`;

  const users: DbUser[] = PEOPLE.map(([uid, first, last, city, dob], i) => ({
    id: uid,
    email: uid === ADMIN_USER_ID ? ADMIN_EMAIL : `${first.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')}@kartup.test`,
    password: TEST_PASSWORD,
    provider: 'email',
    emailConfirmed: true,
    deleted: false,
    firstName: first,
    lastName: last,
    dateOfBirth: dob,
    homeCityId: city,
    bio: uid === TEST_USER_ID ? BIOS[0]! : uid === ADMIN_USER_ID ? 'KartUP team · results & official events.' : pick(BIOS),
    avatarUrl: null,
    locale: 'en',
    role: uid === ADMIN_USER_ID ? 'admin' : 'user',
    termsAcceptedAt: iso(now - 200 * DAY),
    onboardedAt: iso(now - (200 - i) * DAY),
    rankTierId: 1, // set from the generated history below
    payoutsEnabled: ['u-maria', 'u-radu', 'u-vlad', 'u-teodora', 'u-larisa', 'u-ana', TEST_USER_ID].includes(uid),
    createdAt: iso(now - (200 - i * 5) * DAY),
    prefs: { ...DEFAULT_PREFS },
    blocked: [],
  }));

  const sessions: DbSession[] = [];
  const members: DbMember[] = [];
  const payments: DbPayment[] = [];
  const results: DbResults[] = [];
  const messages: Db['messages'] = [];

  function addSession(trackId: string, hostId: string, startsAt: number, o: Partial<DbSession> = {}): DbSession {
    const t = trackById.get(trackId)!;
    const s: DbSession = {
      id: id('s'),
      trackId,
      hostId,
      startsAt: iso(startsAt),
      maxDrivers: o.maxDrivers ?? t.maxDrivers,
      minRankTierId: o.minRankTierId ?? null,
      minSkill: o.minSkill ?? null,
      note: o.note ?? '',
      isOfficialEvent: o.isOfficialEvent ?? false,
      lobbyType: o.lobbyType ?? 'competitive',
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      trackPriceMinor: t.price.perDriverMinor,
      feeMinor: DEFAULT_RULES.platformFeeMinor,
      currency: 'RON',
      priceUpdatedAt: t.price.updatedAt,
      createdAt: iso(Math.min(startsAt, now) - 3 * DAY),
      flags: o.flags ?? {},
    };
    sessions.push(s);
    return s;
  }

  function addMember(s: DbSession, userId: string, status: DbMember['status'], o: Partial<DbMember> = {}) {
    const paid = status !== 'joined_unpaid';
    let paymentId: string | null = null;
    const joinedAt = o.joinedAt ?? iso(new Date(s.createdAt).getTime() + r() * DAY);
    if (paid) {
      paymentId = id('p');
      payments.push({
        id: paymentId,
        sessionId: s.id,
        userId,
        amountMinor: s.trackPriceMinor + s.feeMinor,
        trackMinor: s.trackPriceMinor,
        feeMinor: s.feeMinor,
        currency: s.currency,
        status: status === 'cancelled' ? 'refunded' : 'captured',
        createdAt: joinedAt,
        refundedAt: null,
      });
    }
    members.push({
      sessionId: s.id,
      userId,
      status,
      joinedAt,
      paidAt: paid ? joinedAt : null,
      checkedInAt: status === 'attended' ? iso(new Date(s.startsAt).getTime() - 10 * MIN) : null,
      hostConfirmed: false,
      paymentId,
      ...o,
    });
  }

  /** Results entered by the organizer. Final ones were verified; their km/XP come from the history below. */
  function addResults(s: DbSession, entries: DbResults['entries'], submittedAt: number, final: boolean, responses: DbResults['responses'] = []) {
    results.push({
      sessionId: s.id,
      submittedBy: s.hostId,
      submittedAt: iso(submittedAt),
      deadline: iso(submittedAt + DEFAULT_RULES.resultsConfirmHours * HOUR),
      source: 'organizer',
      printoutUrl: null,
      entries,
      responses,
      adminDecision: null,
      finalizedAt: final ? iso(submittedAt + 2 * HOUR) : null,
    });
  }

  // ── Race history ───────────────────────────────────────────────────────────
  // 1) ~24 lobby sessions over the last 60 days at VMax Romexpo, VMax Titan and AMC
  //    (results entered by the organizer, final = verified);
  // 2) older results imported from the tracks' timing sheets, generated per driver
  //    until they land inside their target rank (see TARGET_RANK).
  const bucTracks = ['t-vmax-romexpo', 't-vmax-titan', 't-amckart'];
  const target = (uid: string) => TARGET_RANK[uid] ?? 0;
  /** Lower = faster. Higher ranks drive faster, with a little randomness. */
  const pace = new Map(users.map((u) => [u.id, 1.14 - 0.018 * target(u.id) + r() * 0.03]));
  const lapMsAt = (trackId: string, userId: string, slower = 0) => {
    const t = trackById.get(trackId)!;
    const base = (t.lapLengthM / (t.indoor ? 14 : 16.5)) * 1000;
    return Math.round(base * pace.get(userId)! * (1 + slower + r() * 0.02));
  };
  const lapsIn = (trackId: string, lapMs: number) => Math.max(1, Math.floor((trackById.get(trackId)!.sessionLengthMin * 60_000) / (lapMs * 1.07)));
  const inputs = new Map<string, VerifiedResult[]>(users.map((u) => [u.id, []]));

  const racers = users.filter((u) => u.homeCityId === 'c-buc' && u.role === 'user' && target(u.id) >= 2 && u.id !== 'u-bogdan');
  for (let i = 0; i < 24; i++) {
    const daysAgo = 3 + Math.floor((i / 24) * 57) + Math.floor(r() * 2);
    const start = atLocal(-daysAgo, `${String(11 + Math.floor(r() * 10)).padStart(2, '0')}:${r() < 0.5 ? '00' : '30'}`);
    const trackId = bucTracks[i % 3]!;
    const t = trackById.get(trackId)!;
    let drivers = [...racers].filter((u) => u.id !== TEST_USER_ID).sort(() => r() - 0.5).slice(0, 4 + Math.floor(r() * 5));
    if (r() < 0.6) drivers = [users.find((u) => u.id === TEST_USER_ID)!, ...drivers.slice(1)];
    const official = i === 7; // one past official KartUP event (XP × 1.5)
    const casual = i % 8 === 3; // a few Casual lobbies: in history, no XP / km
    const s = addSession(trackId, drivers[0]!.id, start, { isOfficialEvent: official, lobbyType: casual ? 'casual' : 'competitive', note: official ? 'KartUP Cup — official event' : casual ? 'Casual run, just for fun.' : '', flags: { reminderSent: true, checkinNotified: true, noShowsProcessed: true, payoutSent: true, lobbyClosed: true } });
    const timed = drivers.map((u) => ({ userId: u.id, bestLapMs: lapMsAt(trackId, u.id) }));
    const order = [...timed].sort((a, b) => a.bestLapMs * (1 + r() * 0.04) - b.bestLapMs * (1 + r() * 0.04));
    const entries = order.map((e, idx) => ({ userId: e.userId, position: idx + 1, laps: lapsIn(trackId, e.bestLapMs * 1.04), bestLapMs: e.bestLapMs }));
    for (const u of drivers) addMember(s, u.id, 'attended');
    addResults(s, entries, start + 2 * HOUR, true);
    const fastest = fastestLapUserIds(entries);
    for (const e of entries) {
      inputs.get(e.userId)!.push({ userId: e.userId, sessionId: s.id, track: t, date: s.startsAt, position: e.position, fieldSize: entries.length, laps: e.laps, bestLapMs: e.bestLapMs, fastestLap: fastest.includes(e.userId), officialEvent: official, source: 'organizer', verifiedBy: s.hostId, casual });
    }
  }

  // Timing-sheet imports, oldest first, until each driver sits inside their target rank.
  const oldestShared = Math.min(...sessions.map((s) => new Date(s.startsAt).getTime()));
  const ledger: DbLedger[] = [];
  for (const u of users) {
    const [lo, hi] = targetWindow(u.id);
    const mine = inputs.get(u.id)!;
    const pool = [...bucTracks, ...(u.homeCityId !== 'c-buc' ? REAL_TRACKS.filter((t) => t.cityId === u.homeCityId).map((t) => t.id) : [])];
    let cursor = oldestShared - 2 * DAY;
    let rows = scoreAll(mine);
    for (let guard = 0; guard < 400; guard++) {
      const tot = totalsOf(rows);
      if (tot.km >= lo.km && tot.xp >= lo.xp) break;
      const trackId = pool[Math.floor(r() * pool.length)]!;
      const t = trackById.get(trackId)!;
      const daysAgo = (now - cursor) / DAY;
      const bestLapMs = lapMsAt(trackId, u.id, Math.min(0.06, daysAgo * 0.0001));
      const roomLaps = Math.floor(((hi.km - tot.km) * 1000) / t.lapLengthM);
      const laps = Math.max(0, Math.min(tot.km < lo.km ? lapsIn(trackId, bestLapMs) : 2, roomLaps));
      const km = (laps * t.lapLengthM) / 1000;
      // Aim for an XP-per-km ratio that reaches both thresholds together.
      const wanted = tot.km < lo.km ? ((lo.xp + hi.xp) / 2 - tot.xp) * (km / Math.max(km, (lo.km + hi.km) / 2 - tot.km)) : lo.xp - tot.xp + 10;
      const fastestRoll = r() < 0.5;
      const candidate = (position: number, fieldSize: number): VerifiedResult => ({ userId: u.id, sessionId: null, track: t, date: new Date(cursor).toISOString(), position, fieldSize, laps, bestLapMs, fastestLap: position === 1 && fastestRoll, officialEvent: false, source: 'timing_sheet', verifiedBy: null });
      // Close to the target: exact gain (re-scores everything). Far away: quick estimate
      // (an older row takes over the +30 new-track bonus if the track was already visited).
      const exact = lo.xp - tot.xp < 400;
      const visited = rows.some((l) => counts(l) && l.trackId === trackId);
      // Only results at the same track interact (new-track / personal-best bonuses).
      const sameTrack = mine.filter((v) => v.track.id === trackId);
      const sameTrackXp = rows.filter((l) => l.trackId === trackId).reduce((a, l) => a + l.xp, 0);
      let best: VerifiedResult | null = null;
      let bestDiff = Infinity;
      for (let n = 6; n <= 10; n++) {
        for (let p = 1; p <= n; p++) {
          const c = candidate(p, n);
          const gain = exact ? totalsOf(scoreAll([...sameTrack, c])).xp - sameTrackXp : sessionXp({ position: p, fieldSize: n, fastestLap: c.fastestLap, personalBest: false, newTrack: !visited, officialEvent: false }, XP_RULES).total;
          if (tot.xp + gain > hi.xp) continue;
          const diff = Math.abs(gain - wanted) + r() * 4; // a little variety in positions
          if (diff < bestDiff) [best, bestDiff] = [c, diff];
        }
      }
      if (!best) break;
      mine.push(best);
      rows = [...rows.filter((l) => l.trackId !== trackId), ...scoreAll([...sameTrack, best])];
      cursor -= (3 + Math.floor(r() * 4)) * DAY;
    }
    ledger.push(...rows);
  }
  ledger.sort((a, b) => a.date.localeCompare(b.date));
  ledger.forEach((l) => (l.id = id('l')));
  for (const u of users) u.rankTierId = rankIdFor(totalsOf(ledger.filter((l) => l.userId === u.id)));

  // ── Upcoming sessions (relative to now) ──────────────────────────────────────
  const u1 = addSession('t-vmax-romexpo', 'u-maria', atLocal(1, '19:00'), { maxDrivers: 10, note: 'Friendly race, all levels welcome! Arrive 15 min early for the briefing.' });
  for (const uid of ['u-maria', 'u-elena', 'u-cristian', 'u-bianca', 'u-alex']) addMember(u1, uid, 'confirmed');
  addMember(u1, 'u-diana', 'joined_unpaid');

  const u2 = addSession('t-amckart', 'u-radu', atLocal(2, '18:30'), { maxDrivers: 8, minSkill: 'intermediate', note: 'Fast group — intermediate drivers and up please.' });
  for (const uid of ['u-radu', 'u-mihai', 'u-vlad', 'u-ana', 'u-cristian', 'u-stefan', 'u-alex']) addMember(u2, uid, 'confirmed');

  const u3 = addSession('t-amckart', TEST_USER_ID, now + 5 * HOUR, { maxDrivers: 8, note: 'My session — need at least 4 paid drivers or it gets cancelled.' });
  addMember(u3, TEST_USER_ID, 'confirmed');
  addMember(u3, 'u-elena', 'confirmed');
  addMember(u3, 'u-mihai', 'confirmed');
  addMember(u3, 'u-ioana', 'joined_unpaid');

  const u4 = addSession('t-vmax-romexpo', 'u-vlad', now + 45 * MIN, { maxDrivers: 10, note: 'After-work sprint. Check in at the reception desk.' });
  for (const uid of ['u-vlad', TEST_USER_ID, 'u-ana', 'u-bogdan', 'u-diana', 'u-stefan']) addMember(u4, uid, 'confirmed');

  const u5 = addSession('t-vmax-timisoara', 'u-sorin', atLocal(1, '18:00'), { maxDrivers: 8, lobbyType: 'casual', note: 'Friday-evening fun run. Casual, just for fun.' });
  for (const uid of ['u-sorin', 'u-raluca', 'u-gabriel', 'u-teodora']) addMember(u5, uid, 'confirmed');

  const u6 = addSession('t-vmax-cluj', 'u-larisa', atLocal(3, '17:00'), { maxDrivers: 12, minRankTierId: 2, note: 'Amateur rank and up.' });
  for (const uid of ['u-larisa', 'u-paul', 'u-sorin', 'u-gabriel', 'u-raluca']) addMember(u6, uid, 'confirmed');

  const u7 = addSession('t-amckart', 'u-ana', atLocal(6, '11:00'), { maxDrivers: 12, lobbyType: 'casual', note: 'Weekend endurance-style: 2 × 15 minutes. Casual — no ranking.' });
  for (const uid of ['u-ana', 'u-ioana']) addMember(u7, uid, 'confirmed');

  const t1 = addSession('t-vmax-titan', 'u-cristian', atLocal(1, '20:30'), { maxDrivers: 10, note: 'Electric karts with boost — first time at Titan for most of us, come try it!' });
  for (const uid of ['u-cristian', 'u-bianca', 'u-diana', 'u-stefan', 'u-elena', 'u-alex']) addMember(t1, uid, 'confirmed');
  addMember(t1, 'u-ioana', 'joined_unpaid');

  const t2 = addSession('t-vmax-titan', 'u-vlad', atLocal(3, '19:00'), { maxDrivers: 10, minRankTierId: 2, note: 'Mini Grand Prix format, Amateur rank and up.' });
  for (const uid of ['u-vlad', 'u-mihai', 'u-radu', 'u-ana']) addMember(t2, uid, 'confirmed');

  // Official KartUP event (marked by an admin): XP × 1.5 for everyone.
  const e1 = addSession('t-vmax-romexpo', 'u-cristian', atLocal(5, '19:00'), { maxDrivers: 10, isOfficialEvent: true, note: 'KartUP Cup — official event. XP × 1.5 for every driver!' });
  for (const uid of ['u-cristian', 'u-radu', 'u-maria', 'u-vlad', 'u-stefan']) addMember(e1, uid, 'confirmed');

  const u8 = addSession('t-vmax-romexpo', 'u-maria', atLocal(4, '20:00'), { maxDrivers: 10 });
  for (const uid of ['u-maria', 'u-radu', 'u-mihai', 'u-ana', 'u-vlad', 'u-bogdan', 'u-cristian', 'u-alex', 'u-bianca', 'u-stefan']) addMember(u8, uid, 'confirmed');

  // ── Past sessions waiting for something from the test user ─────────────────
  // P1: Andrei hosted 2h ago; check-in done; he must enter the results.
  const p1 = addSession('t-vmax-romexpo', TEST_USER_ID, now - 2 * HOUR, { maxDrivers: 10, flags: { reminderSent: true, checkinNotified: true, noShowsProcessed: true, lobbyClosed: true } });
  for (const uid of [TEST_USER_ID, 'u-maria', 'u-radu', 'u-elena', 'u-alex', 'u-diana']) addMember(p1, uid, 'attended');

  // P2: Radu hosted yesterday; results posted; everyone confirmed except Andrei.
  const p2Start = now - 20 * HOUR;
  const p2 = addSession('t-amckart', 'u-radu', p2Start, { maxDrivers: 8, flags: { reminderSent: true, checkinNotified: true, noShowsProcessed: true, lobbyClosed: true } });
  const p2Order = ['u-radu', 'u-vlad', TEST_USER_ID, 'u-mihai', 'u-ana', 'u-stefan', 'u-cristian'];
  for (const uid of p2Order) addMember(p2, uid, 'attended');
  addResults(
    p2,
    p2Order.map((userId, i) => {
      const bestLapMs = lapMsAt('t-amckart', userId) + i * 250;
      return { userId, position: i + 1, laps: lapsIn('t-amckart', bestLapMs * 1.04), bestLapMs };
    }),
    p2Start + HOUR,
    false,
    p2Order.filter((u) => u !== 'u-radu' && u !== TEST_USER_ID).map((userId) => ({ userId, response: 'confirm' as const, comment: null })),
  );

  // ── Chat ─────────────────────────────────────────────────────────────────────
  const say = (s: DbSession, userId: string, body: string, minutesAgo: number) =>
    messages.push({ id: id('m'), sessionId: s.id, userId, body, createdAt: iso(now - minutesAgo * MIN) });
  say(u1, 'u-maria', 'Welcome everyone! Booked the 10-kart slot, pay your share to lock your seat 👍', 600);
  say(u1, 'u-elena', 'In! First time at VMax, any tips?', 420);
  say(u1, 'u-cristian', 'Brake early in the hairpin, the exit matters more.', 400);
  say(u4, 'u-vlad', 'See you all at 7! Reception is on the left.', 180);
  say(u4, 'u-ana', pick(CHAT), 60);
  say(u4, 'u-stefan', pick(CHAT), 30);
  say(t1, 'u-cristian', 'Booked 20:30 at Titan, 10 karts. Pay your seat to lock it in 🔋', 240);
  say(t1, 'u-bianca', 'Is the boost button on the steering wheel?', 200);
  say(t1, 'u-cristian', 'Yes, right thumb. Use it on the long straight!', 190);
  say(u3, 'u-elena', 'Can we get one more driver? Asking my brother.', 90);

  // ── Experience: summary of each driver's verified history per track ─────────
  const experience: DbExperience[] = [];
  for (const l of ledger) {
    if (l.kind !== 'race') continue;
    const e = experience.find((x) => x.userId === l.userId && x.trackId === l.trackId);
    if (e) {
      e.sessionsCount += 1;
      if (l.bestLapMs && (!e.bestLapMs || l.bestLapMs < e.bestLapMs)) e.bestLapMs = l.bestLapMs;
    } else experience.push({ userId: l.userId, trackId: l.trackId, level: 'beginner', bestLapMs: l.bestLapMs, sessionsCount: 1 });
  }
  for (const e of experience) e.level = e.sessionsCount >= 15 ? 'advanced' : e.sessionsCount >= 5 ? 'intermediate' : 'beginner';

  // ── Self-reported results (UNVERIFIED until an admin approves them) ──────────
  const selfReport = (userId: string, trackId: string, daysAgo: number, position: number, fieldSize: number, laps: number, bestLapMs: number): Db['selfReports'][number] => ({
    id: id('sr'),
    userId,
    trackId,
    date: iso(atLocal(-daysAgo, '12:00')),
    position,
    fieldSize,
    laps,
    bestLapMs,
    status: 'pending',
    createdAt: iso(now - (daysAgo - 1) * DAY),
    reviewedBy: null,
    reviewedAt: null,
  });
  const selfReports = [
    selfReport(TEST_USER_ID, 't-vmax-titan', 9, 2, 8, 14, lapMsAt('t-vmax-titan', TEST_USER_ID)),
    selfReport('u-diana', 't-amckart', 6, 1, 6, 7, lapMsAt('t-amckart', 'u-diana')),
  ];

  // ── One active ban (shows on Bogdan's public profile) ───────────────────────
  const noShowId = id('ns');
  const db: Db = {
    version: DB_VERSION,
    seededAt: new Date(realNow).toISOString(),
    clockOffsetMs: 0,
    currentUserId: null,
    simulatedAtTrack: true,
    seq: 0,
    cities,
    tracks,
    users,
    sessions,
    members,
    payments,
    messages,
    results,
    ledger,
    selfReports,
    instantResults: true,
    bans: [
      { id: id('b'), userId: 'u-bogdan', startsAt: iso(now - 4 * HOUR), endsAt: iso(now + 20 * HOUR), reason: 'no_show', offense: 2, noShowId, liftedAt: null, endNotified: false, appeal: null },
    ],
    noShows: [
      { id: id('ns'), userId: 'u-bogdan', sessionId: sessions[0]!.id, createdAt: iso(now - 40 * DAY), voided: false },
      { id: noShowId, userId: 'u-bogdan', sessionId: sessions[1]!.id, createdAt: iso(now - 4 * HOUR), voided: false },
    ],
    notifications: [
      { id: id('n'), userId: TEST_USER_ID, type: 'results_posted', createdAt: iso(p2Start + HOUR), readAt: null, data: { sessionId: p2.id, trackName: 'AMC Kart' } },
    ],
    emails: [],
    reports: [],
    experience,
    payouts: [],
  };
  // Past sessions whose payout already went out: record the host payout (track price × kept seats).
  for (const s of sessions) {
    if (!s.flags.payoutSent || s.cancelledAt) continue;
    const kept = members.filter((m) => m.sessionId === s.id && ['confirmed', 'attended', 'no_show'].includes(m.status)).length;
    if (kept) db.payouts.push({ sessionId: s.id, hostId: s.hostId, amountMinor: kept * s.trackPriceMinor, createdAt: iso(new Date(s.startsAt).getTime() + DAY) });
  }
  // Bogdan's recent no-show (Competitive lobby): −50 XP behavior penalty. His rank stays.
  const missed = sessions[1]!;
  db.ledger.push(penaltyRow(db.ledger, { userId: 'u-bogdan', reason: 'no_show', nominal: PENALTIES.noShow, sessionId: missed.id, track: trackById.get(missed.trackId)!, date: iso(now - 4 * HOUR) }, id('l'), iso(now - 4 * HOUR)));
  db.seq = seq;
  return db;
}
