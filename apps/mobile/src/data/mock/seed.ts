/**
 * Fictional but realistic demo data for the web preview. Every person, track and
 * price here is made up. Times are generated relative to "now" so the scenarios
 * (session in 45 min, results waiting, …) always make sense when you reset.
 */
import { DEFAULT_RULES, pointsFor } from '@kartup/domain';
import type { City, NotificationPrefs } from '../types';
import { REAL_TRACKS } from './tracks';
import { localDateKey, zonedToUtc } from '@/lib/format';
import { DB_VERSION, type Db, type DbExperience, type DbLedger, type DbMember, type DbPayment, type DbResults, type DbSession, type DbUser } from './db';

export const TEST_PASSWORD = 'kartup123';
export const TEST_EMAIL = 'andrei@kartup.test';
export const TEST_USER_ID = 'u-andrei';

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
    email: `${first.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')}@kartup.test`,
    password: TEST_PASSWORD,
    provider: 'email',
    emailConfirmed: true,
    deleted: false,
    firstName: first,
    lastName: last,
    dateOfBirth: dob,
    homeCityId: city,
    bio: uid === TEST_USER_ID ? BIOS[0]! : pick(BIOS),
    avatarUrl: null,
    locale: 'en',
    role: 'user',
    termsAcceptedAt: iso(now - 200 * DAY),
    onboardedAt: iso(now - (200 - i) * DAY),
    payoutsEnabled: ['u-maria', 'u-radu', 'u-vlad', 'u-teodora', 'u-larisa', 'u-ana', TEST_USER_ID].includes(uid),
    createdAt: iso(now - (200 - i * 5) * DAY),
    prefs: { ...DEFAULT_PREFS },
    blocked: [],
  }));

  const sessions: DbSession[] = [];
  const members: DbMember[] = [];
  const payments: DbPayment[] = [];
  const results: DbResults[] = [];
  const ledger: DbLedger[] = [];
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

  function addResults(s: DbSession, order: string[], submittedAt: number, final: boolean, responses: DbResults['responses'] = []) {
    const start = new Date(s.startsAt).getTime();
    const entries = order.map((userId, i) => ({ userId, position: i + 1, bestLapMs: Math.round(46000 + i * 700 + r() * 2500) }));
    results.push({
      sessionId: s.id,
      submittedBy: s.hostId,
      submittedAt: iso(submittedAt),
      deadline: iso(submittedAt + DEFAULT_RULES.resultsConfirmHours * HOUR),
      printoutUrl: null,
      entries,
      responses,
      adminDecision: null,
      finalizedAt: final ? iso(submittedAt + 2 * HOUR) : null,
    });
    if (final) {
      const t = trackById.get(s.trackId)!;
      const season = new Intl.DateTimeFormat('en-CA', { timeZone: t.timezone, year: 'numeric', month: '2-digit' }).format(start).slice(0, 7);
      for (const e of entries) {
        ledger.push({
          id: id('l'),
          userId: e.userId,
          sessionId: s.id,
          trackId: t.id,
          cityId: t.cityId,
          season,
          points: pointsFor(e.position, entries.length, DEFAULT_RULES.points),
          position: e.position,
          fieldSize: entries.length,
          createdAt: iso(submittedAt + 2 * HOUR),
        });
      }
    }
  }

  // ── History: ~34 finished sessions over the last 100 days ──────────────────
  const bucTracks = ['t-vmax-romexpo', 't-vmax-titan', 't-amckart'];
  const others = users.filter((u) => u.id !== TEST_USER_ID);
  let andreiPoints = 0;
  for (let i = 0; i < 34; i++) {
    const daysAgo = 3 + Math.floor((i / 34) * 97) + Math.floor(r() * 2);
    const start = atLocal(-daysAgo, `${String(11 + Math.floor(r() * 10)).padStart(2, '0')}:${r() < 0.5 ? '00' : '30'}`);
    const inBuc = r() < 0.75;
    const trackId = inBuc ? pick(bucTracks) : pick(['t-tomiskart', 't-tt-transilvania', 't-greenkart-tm', 't-iasi-indoor', 't-prejmer', 't-masterkart']);
    const t = trackById.get(trackId)!;
    const localPool = others.filter((u) => u.homeCityId === t.cityId || r() < 0.08);
    const size = Math.min(localPool.length + 1, 4 + Math.floor(r() * 6));
    const drivers = [...localPool].sort(() => r() - 0.5).slice(0, size);
    const includeAndrei = inBuc && andreiPoints < 900 && r() < 0.7;
    if (includeAndrei) drivers[drivers.length - 1] = users[0]!;
    if (drivers.length < 3) continue;
    const s = addSession(trackId, drivers[0]!.id, start, { flags: { reminderSent: true, checkinNotified: true, noShowsProcessed: true, payoutSent: true, lobbyClosed: true } });
    const order = [...drivers].sort(() => r() - 0.5).map((u) => u.id);
    // Keep Andrei's total in a range where finishing one of the waiting sessions ranks him up.
    if (includeAndrei) {
      const idx = order.indexOf(TEST_USER_ID);
      order.splice(idx, 1);
      let pos = Math.floor(r() * order.length);
      while (pos < order.length && andreiPoints + pointsFor(pos + 1, order.length + 1, DEFAULT_RULES.points) > 960) pos++;
      order.splice(pos, 0, TEST_USER_ID);
      andreiPoints += pointsFor(pos + 1, order.length, DEFAULT_RULES.points);
    }
    for (const u of drivers) addMember(s, u.id, 'attended');
    addResults(s, order, start + 2 * HOUR, true);
  }

  // Top up so Andrei sits at 945–975 points: 1000 = Club Racer, so either waiting
  // session (P1: +81 for a win, P2: +60 for 3rd) triggers a visible rank-up.
  const bucLocals = others.filter((u) => u.homeCityId === 'c-buc');
  for (let extra = 0; andreiPoints < 945 && extra < 30; extra++) {
    const start = atLocal(-(5 + extra * 3), '18:00');
    const field = [users[0]!, ...[...bucLocals].sort(() => r() - 0.5).slice(0, 5)];
    const s = addSession(pick(bucTracks), field[1]!.id, start, { flags: { reminderSent: true, checkinNotified: true, noShowsProcessed: true, payoutSent: true, lobbyClosed: true } });
    let pos = 1;
    while (pos < field.length && andreiPoints + pointsFor(pos, field.length, DEFAULT_RULES.points) > 975) pos++;
    const order = field.slice(1).map((u) => u.id);
    order.splice(pos - 1, 0, TEST_USER_ID);
    andreiPoints += pointsFor(pos, field.length, DEFAULT_RULES.points);
    for (const u of field) addMember(s, u.id, 'attended');
    addResults(s, order, start + 2 * HOUR, true);
  }

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

  const u5 = addSession('t-tomiskart', 'u-teodora', atLocal(1, '18:00'), { maxDrivers: 8, note: 'Sunset session by the sea 🌅' });
  for (const uid of ['u-teodora', 'u-raluca', 'u-gabriel', 'u-sorin']) addMember(u5, uid, 'confirmed');

  const u6 = addSession('t-tt-transilvania', 'u-larisa', atLocal(3, '17:00'), { maxDrivers: 12, minRankTierId: 2, note: 'Amateur rank and up.' });
  for (const uid of ['u-larisa', 'u-paul', 'u-sorin', 'u-gabriel', 'u-raluca']) addMember(u6, uid, 'confirmed');

  const u7 = addSession('t-amckart', 'u-ana', atLocal(6, '11:00'), { maxDrivers: 12, note: 'Weekend endurance-style: 2 × 15 minutes.' });
  for (const uid of ['u-ana', 'u-ioana']) addMember(u7, uid, 'confirmed');

  const t1 = addSession('t-vmax-titan', 'u-cristian', atLocal(1, '20:30'), { maxDrivers: 10, note: 'Electric karts with boost — first time at Titan for most of us, come try it!' });
  for (const uid of ['u-cristian', 'u-bianca', 'u-diana', 'u-stefan', 'u-elena', 'u-alex']) addMember(t1, uid, 'confirmed');
  addMember(t1, 'u-ioana', 'joined_unpaid');

  const t2 = addSession('t-vmax-titan', 'u-vlad', atLocal(3, '19:00'), { maxDrivers: 10, minRankTierId: 2, note: 'Mini Grand Prix format, Amateur rank and up.' });
  for (const uid of ['u-vlad', 'u-mihai', 'u-radu', 'u-ana']) addMember(t2, uid, 'confirmed');

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
    p2Order,
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

  // ── Experience ────────────────────────────────────────────────────────────────
  const experience: DbExperience[] = [
    { userId: TEST_USER_ID, trackId: 't-vmax-romexpo', level: 'advanced', bestLapMs: 49876, sessionsCount: 14 },
    { userId: TEST_USER_ID, trackId: 't-amckart', level: 'intermediate', bestLapMs: 61234, sessionsCount: 7 },
    { userId: TEST_USER_ID, trackId: 't-vmax-titan', level: 'intermediate', bestLapMs: 44912, sessionsCount: 4 },
  ];
  for (const u of others) experience.push({ userId: u.id, trackId: bucTracks.includes(pick(bucTracks)) ? pick(bucTracks) : 't-vmax-romexpo', level: pick(['beginner', 'intermediate', 'advanced'] as const), bestLapMs: Math.round(47000 + r() * 9000), sessionsCount: 1 + Math.floor(r() * 20) });

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
  db.seq = seq;
  return db;
}
