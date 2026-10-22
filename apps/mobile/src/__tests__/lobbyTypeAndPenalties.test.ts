/**
 * Casual vs Competitive lobbies and behavior penalties in the demo backend:
 * casual results give no progression, each penalty applies only in Competitive
 * lobbies, total XP never goes below 0, and ranks never go down.
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { PENALTIES } from '@config/progression';
import { MockServer } from '@/data/mock/server';
import { penaltyRow, scoreResult } from '@/data/mock/progression';
import { ADMIN_USER_ID, TEST_USER_ID } from '@/data/mock/seed';
import type { DbLedger } from '@/data/mock/db';

const MIN = 60_000;
let s: MockServer;

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(s.now());
const p1Of = () => s.db.sessions.find((x) => x.hostId === TEST_USER_ID && new Date(x.startsAt).getTime() < s.now().getTime() && !s.resultsOf(x.id))!;
const attendedOf = (sessionId: string) => s.membersOf(sessionId).filter((m) => m.status === 'attended').map((m) => m.userId);
const penalties = (userId: string, reason?: string) => s.db.ledger.filter((l) => l.userId === userId && l.kind === 'penalty' && (!reason || l.penaltyReason === reason));
const jumpTo = (sessionId: string, offsetMin: number) => s.setClockOffset(new Date(s.session(sessionId).startsAt).getTime() + offsetMin * MIN - Date.now());
/** Maria's VMax Romexpo lobby tomorrow (Competitive, no rank limit). */
const mariasLobby = () => s.db.sessions.find((x) => x.hostId === 'u-maria' && new Date(x.startsAt).getTime() > s.now().getTime() && new Date(x.startsAt).getTime() < s.now().getTime() + 2 * 24 * 60 * MIN)!;
const joinAndPay = (sessionId: string) => {
  const intent = s.createIntent(sessionId);
  expect(s.confirmPayment(intent.paymentId, '4242424242424242')).toEqual({ status: 'seat_confirmed' });
};
const seasonXp = (userId: string) => s.leaderboard({ kind: 'season', season: s.db.ledger.at(-1)!.season }).find((e) => e.user.id === userId)?.xp ?? 0;
const submitP1 = () => {
  const p1 = p1Of();
  s.submitResults(p1.id, attendedOf(p1.id).map((userId, i) => ({ userId, position: i + 1, laps: 12, bestLapMs: 47_000 + i * 300 })), null);
  return p1;
};

beforeEach(() => {
  s = new MockServer();
  s.reset();
  s.signInAs(TEST_USER_ID);
});

describe('lobby type', () => {
  it('new lobbies are Competitive unless the host picks Casual', () => {
    s.mutate(() => (s.user(TEST_USER_ID)!.payoutsEnabled = true));
    const base = { trackId: 't-amckart', startsAt: new Date(s.now().getTime() + 2 * 24 * 60 * MIN).toISOString(), maxDrivers: 8, minRankTierId: null, minSkill: null, note: '' };
    expect(s.createSession({ ...base, lobbyType: 'competitive' }).lobbyType).toBe('competitive');
    expect(s.createSession({ ...base, lobbyType: 'casual' }).lobbyType).toBe('casual');
  });

  it('casual results are saved in history but give no XP, km, season XP or rank', () => {
    const p1 = p1Of();
    s.mutate(() => (s.session(p1.id).lobbyType = 'casual'));
    const before = s.totals(TEST_USER_ID);
    const seasonBefore = seasonXp(TEST_USER_ID);
    submitP1();
    const results = s.getResults(p1.id)!;
    expect(results).toMatchObject({ status: 'final', lobbyType: 'casual' });
    expect(results.entries.every((e) => e.xp === null && e.km === null && e.laps === 12)).toBe(true);
    expect(s.totals(TEST_USER_ID)).toEqual(before);
    expect(seasonXp(TEST_USER_ID)).toBe(seasonBefore);
    expect(s.rankOf(TEST_USER_ID).key).toBe('clubRacer'); // the same result in Competitive would rank him up
    const row = s.progressHistory(TEST_USER_ID).find((p) => p.sessionId === p1.id)!;
    expect(row).toMatchObject({ kind: 'race', casual: true, xp: null, km: null, position: 1, laps: 12 });
  });

  it('casual results never count for personal-best or new-track bonuses', () => {
    const track = s.track('t-vmax-titan');
    const base = { userId: 'x', sessionId: null, track, position: 1, fieldSize: 6, laps: 10, fastestLap: false, officialEvent: false, source: 'organizer' as const, verifiedBy: null };
    const ledger: DbLedger[] = [scoreResult([], { ...base, date: '2026-01-01T10:00:00.000Z', bestLapMs: 40_000, casual: true }, 'a', '')];
    expect(ledger[0]).toMatchObject({ casual: true, xp: 0, meters: 0, breakdown: null });
    const next = scoreResult(ledger, { ...base, date: '2026-02-01T10:00:00.000Z', bestLapMs: 39_000 }, 'b', '');
    expect(next.breakdown!.newTrack).toBe(30); // the casual visit didn't use the new-track bonus
    expect(next.breakdown!.personalBest).toBe(0); // and isn't a lap to beat
  });

  it('official KartUP events are always Competitive', () => {
    const p1 = p1Of();
    s.mutate(() => (s.session(p1.id).lobbyType = 'casual'));
    s.setOfficialEvent(p1.id, true, ADMIN_USER_ID);
    expect(s.kartSession(s.session(p1.id)).lobbyType).toBe('competitive');
    submitP1();
    expect(s.getResults(p1.id)!.entries[0]!.xp).toBeGreaterThan(0);
  });
});

describe('behavior penalties', () => {
  it(`no-show in a Competitive lobby: −${PENALTIES.noShow} XP (rank kept)`, () => {
    const u4 = s.db.sessions.find((x) => x.hostId === 'u-vlad' && s.member(x.id, TEST_USER_ID)?.status === 'confirmed')!;
    const before = s.totals(TEST_USER_ID).xp;
    jumpTo(u4.id, 16); // check-in closed, Andrei never checked in
    expect(s.member(u4.id, TEST_USER_ID)!.status).toBe('no_show');
    expect(penalties(TEST_USER_ID).map((l) => [l.penaltyReason, l.xp])).toEqual([['no_show', -50]]);
    expect(s.totals(TEST_USER_ID).xp).toBe(before - 50);
    expect(s.rankOf(TEST_USER_ID).key).toBe('clubRacer');
    const row = s.progressHistory(TEST_USER_ID).find((p) => p.kind === 'penalty')!;
    expect(row).toMatchObject({ penaltyReason: 'no_show', xp: -50, penaltyNominal: 50 });
    expect(s.db.notifications.some((n) => n.userId === TEST_USER_ID && n.type === 'xp_penalty')).toBe(true);
  });

  it('no-show in a Casual lobby: the ban still applies, but no XP penalty', () => {
    const u4 = s.db.sessions.find((x) => x.hostId === 'u-vlad' && s.member(x.id, TEST_USER_ID)?.status === 'confirmed')!;
    s.mutate(() => (s.session(u4.id).lobbyType = 'casual'));
    jumpTo(u4.id, 16);
    expect(s.member(u4.id, TEST_USER_ID)!.status).toBe('no_show');
    expect(penalties(TEST_USER_ID)).toHaveLength(0);
  });

  it(`leaving less than 2 h before the start: −${PENALTIES.lateLeave} XP; earlier or Casual: nothing`, () => {
    const u1 = mariasLobby();
    joinAndPay(u1.id);
    jumpTo(u1.id, -150); // 2.5 h before (the clock jump also makes Andrei miss another lobby: a separate no-show)
    s.cancelSeat(u1.id);
    expect(penalties(TEST_USER_ID, 'late_leave')).toHaveLength(0);

    joinAndPay(u1.id);
    jumpTo(u1.id, -90); // 1.5 h before (still refundable)
    const before = s.totals(TEST_USER_ID).xp;
    expect(s.cancelSeat(u1.id)).toEqual({ refunded: true });
    expect(penalties(TEST_USER_ID, 'late_leave').map((l) => l.xp)).toEqual([-25]);
    expect(s.totals(TEST_USER_ID).xp).toBe(before - 25);
  });

  it('leaving a Casual lobby late costs nothing', () => {
    const u1 = mariasLobby();
    s.mutate(() => (s.session(u1.id).lobbyType = 'casual'));
    joinAndPay(u1.id);
    jumpTo(u1.id, -90);
    s.cancelSeat(u1.id);
    expect(penalties(TEST_USER_ID, 'late_leave')).toHaveLength(0);
  });

  it(`false self-reported result (admin decision): −${PENALTIES.falseReport} XP; a plain rejection costs nothing`, () => {
    const report = () => s.selfReport({ trackId: 't-amckart', date: today(), position: 1, fieldSize: 8, laps: 12, bestLapMs: null });
    const before = s.totals(TEST_USER_ID).xp;
    report();
    s.reviewSelfReport(s.db.selfReports.at(-1)!.id, 'reject', ADMIN_USER_ID);
    expect(s.totals(TEST_USER_ID).xp).toBe(before);
    report();
    s.reviewSelfReport(s.db.selfReports.at(-1)!.id, 'reject_false', ADMIN_USER_ID);
    expect(penalties(TEST_USER_ID).map((l) => [l.penaltyReason, l.xp])).toEqual([['false_report', -100]]);
    expect(s.totals(TEST_USER_ID).xp).toBe(before - 100);
  });

  it('losing a dispute with false data (admin decision): −100 XP for the disputing driver', () => {
    const p2 = s.db.sessions.find((x) => x.hostId === 'u-radu' && s.resultsOf(x.id) && !s.resultsOf(x.id)!.finalizedAt)!;
    s.respondResults(p2.id, 'dispute', 'I won, not Radu');
    s.adminDecide(p2.id, true, true);
    expect(penalties(TEST_USER_ID).map((l) => [l.penaltyReason, l.xp])).toEqual([['false_report', -100]]);
    expect(penalties('u-vlad')).toHaveLength(0); // only the driver who disputed
  });

  it('an admin approving results without calling the dispute false gives no penalty', () => {
    const p2 = s.db.sessions.find((x) => x.hostId === 'u-radu' && s.resultsOf(x.id) && !s.resultsOf(x.id)!.finalizedAt)!;
    s.respondResults(p2.id, 'dispute', 'honest mistake');
    s.adminDecide(p2.id, true);
    expect(penalties(TEST_USER_ID)).toHaveLength(0);
  });

  it('penalties also lower the current season’s XP', () => {
    submitP1();
    const before = seasonXp(TEST_USER_ID);
    expect(before).toBeGreaterThan(100);
    s.selfReport({ trackId: 't-amckart', date: today(), position: 1, fieldSize: 8, laps: 12, bestLapMs: null });
    s.reviewSelfReport(s.db.selfReports.at(-1)!.id, 'reject_false', ADMIN_USER_ID);
    expect(seasonXp(TEST_USER_ID)).toBe(before - 100);
  });
});

describe('0 XP floor', () => {
  it('a penalty never takes more than the driver has', () => {
    const track = s.track('t-amckart');
    const ledger: DbLedger[] = [{ ...scoreResult([], { userId: 'x', sessionId: null, track, date: '2026-01-01T10:00:00.000Z', position: 8, fieldSize: 8, laps: 5, bestLapMs: null, fastestLap: false, officialEvent: false, source: 'organizer', verifiedBy: null }, 'a', ''), xp: 30 }];
    const row = penaltyRow(ledger, { userId: 'x', reason: 'no_show', nominal: 50, sessionId: null, track, date: '2026-01-02T10:00:00.000Z' }, 'p', '');
    expect(row.xp).toBe(-30);
    expect(row.penaltyNominal).toBe(50);
  });

  it('a driver with 0 XP stays at 0 after a penalty, and never shows negative on a leaderboard', () => {
    s.signInAs('u-ioana'); // brand-new driver: 0 XP
    expect(s.totals('u-ioana').xp).toBe(0);
    const u1 = mariasLobby();
    joinAndPay(u1.id);
    jumpTo(u1.id, -90);
    s.cancelSeat(u1.id);
    expect(penalties('u-ioana').map((l) => l.xp)).toEqual([-0]);
    expect(s.totals('u-ioana').xp).toBe(0);
    expect(s.progressHistory('u-ioana')[0]).toMatchObject({ kind: 'penalty', penaltyNominal: 25 });
    for (const scope of [{ kind: 'global' as const }, { kind: 'season' as const, season: s.seasons()[0]! }]) {
      expect(s.leaderboard(scope).every((e) => e.xp >= 0)).toBe(true);
    }
  });
});

describe('ranks never go down', () => {
  it('stay at the highest rank reached even when penalties drop XP below the threshold', () => {
    submitP1();
    expect(s.rankOf(TEST_USER_ID).key).toBe('contender');
    for (let i = 0; i < 4; i++) {
      s.selfReport({ trackId: 't-amckart', date: today(), position: 8, fieldSize: 8, laps: 1, bestLapMs: null });
      s.reviewSelfReport(s.db.selfReports.at(-1)!.id, 'reject_false', ADMIN_USER_ID);
    }
    expect(s.totals(TEST_USER_ID).xp).toBeLessThan(2500); // Contender needs 2,500 XP
    expect(s.rankOf(TEST_USER_ID).key).toBe('contender');
    expect(s.summary(TEST_USER_ID).rankTierId).toBe(4);
    expect(s.db.notifications.filter((n) => n.userId === TEST_USER_ID && n.type === 'rank_up')).toHaveLength(1);
  });
});

describe('demo seed', () => {
  it('has casual sessions in the history and one no-show penalty', () => {
    const casualSessions = s.db.sessions.filter((x) => x.lobbyType === 'casual');
    expect(casualSessions.length).toBeGreaterThanOrEqual(3);
    expect(s.db.ledger.some((l) => l.casual && l.xp === 0 && l.meters === 0)).toBe(true);
    expect(s.db.sessions.some((x) => x.lobbyType === 'casual' && new Date(x.startsAt).getTime() > s.now().getTime())).toBe(true);
    const p = s.db.ledger.filter((l) => l.kind === 'penalty');
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ userId: 'u-bogdan', penaltyReason: 'no_show', xp: -50 });
  });
});
