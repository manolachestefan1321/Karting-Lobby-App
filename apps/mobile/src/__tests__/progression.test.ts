/**
 * Rank progression in the demo backend: only VERIFIED results give km / XP, only
 * admins approve self-reports, demo results are final at once, ranks never drop,
 * and the demo seed covers all 8 ranks (and stays out of the real database).
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { RANKS } from '@config/progression';
import { MockServer } from '@/data/mock/server';
import { ADMIN_USER_ID, TARGET_RANK, TEST_USER_ID } from '@/data/mock/seed';
import { ApiError } from '@/data/api';

let s: MockServer;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(s.now());
const p1Of = () => s.db.sessions.find((x) => x.hostId === TEST_USER_ID && new Date(x.startsAt).getTime() < s.now().getTime() && !s.resultsOf(x.id))!;
const attendedOf = (sessionId: string) => s.membersOf(sessionId).filter((m) => m.status === 'attended').map((m) => m.userId);
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as ApiError).code;
  }
  return null;
};

beforeEach(() => {
  s = new MockServer();
  s.reset();
  s.signInAs(TEST_USER_ID);
});

describe('demo seed', () => {
  it('has fake drivers in every one of the 8 ranks', () => {
    const reached = new Set(s.db.users.filter((u) => u.role === 'user').map((u) => s.rankOf(u.id).key));
    expect([...reached].sort()).toEqual(RANKS.map((r) => r.key).sort());
  });

  it('puts every driver in their target rank, consistent with their verified km and XP', () => {
    for (const [userId, index] of Object.entries(TARGET_RANK)) {
      const t = s.totals(userId);
      const rank = RANKS[index]!;
      expect(s.rankOf(userId).key).toBe(rank.key);
      expect(t.km).toBeGreaterThanOrEqual(rank.minKm);
      expect(t.xp).toBeGreaterThanOrEqual(rank.minXp);
    }
  });

  it('history is at VMax Romexpo, VMax Titan and AMC Kart (plus home tracks), all verified', () => {
    const tracks = new Set(s.db.ledger.map((l) => l.trackId));
    for (const id of ['t-vmax-romexpo', 't-vmax-titan', 't-amckart']) expect(tracks.has(id)).toBe(true);
    expect(s.db.ledger.every((l) => ['organizer', 'timing_sheet'].includes(l.source))).toBe(true);
  });

  it('Andrei sits just below Contender on both km and XP', () => {
    const t = s.totals(TEST_USER_ID);
    expect(s.rankOf(TEST_USER_ID).key).toBe('clubRacer');
    expect(t.km).toBeLessThan(150);
    expect(t.km).toBeGreaterThan(148.5); // 2 laps at VMax Romexpo (700 m) reach 150 km
    expect(t.xp).toBeLessThan(2500);
    expect(t.xp).toBeGreaterThanOrEqual(2475); // even last place (+25 XP) reaches 2,500
  });
});

describe('verified results → km, XP, rank-up (demo: final immediately)', () => {
  it('host enters results: verified at once in the demo, km = laps × lap length, rank-up celebration', () => {
    const p1 = p1Of();
    const before = s.totals(TEST_USER_ID);
    const attended = attendedOf(p1.id);
    // Andrei last of 6: 25 XP only — still enough (both thresholds) for Contender.
    const order = [...attended.filter((u) => u !== TEST_USER_ID), TEST_USER_ID];
    s.submitResults(p1.id, order.map((userId, i) => ({ userId, position: i + 1, laps: 3, bestLapMs: 60_000 + i * 500 })), null);
    expect(s.getResults(p1.id)!.status).toBe('final');
    const me = s.getResults(p1.id)!.entries.find((e) => e.userId === TEST_USER_ID)!;
    expect(me.km).toBeCloseTo(2.1); // 3 laps × 700 m
    expect(me.xp).toBe(25);
    expect(s.totals(TEST_USER_ID).xp).toBe(before.xp + 25);
    expect(s.rankOf(TEST_USER_ID).key).toBe('contender');
    const rankUp = s.db.notifications.find((n) => n.userId === TEST_USER_ID && n.type === 'rank_up')!;
    expect(rankUp.data).toMatchObject({ rank: 'contender', rankId: 4 });
  });

  it('fastest lap of the session gets +20 XP', () => {
    const p1 = p1Of();
    const attended = attendedOf(p1.id);
    s.submitResults(p1.id, attended.map((userId, i) => ({ userId, position: i + 1, laps: 10, bestLapMs: i === 2 ? 40_000 : 60_000 })), null);
    const third = s.getResults(p1.id)!.entries[2]!;
    expect(third.breakdown!.fastestLap).toBe(20);
    expect(s.getResults(p1.id)!.entries[0]!.breakdown!.fastestLap).toBe(0);
  });

  it('official KartUP events multiply the session XP by 1.5', () => {
    const p1 = p1Of();
    s.setOfficialEvent(p1.id, true, ADMIN_USER_ID);
    const attended = attendedOf(p1.id);
    s.submitResults(p1.id, attended.map((userId, i) => ({ userId, position: i + 1, laps: 10, bestLapMs: null })), null);
    const winner = s.getResults(p1.id)!.entries[0]!;
    expect(winner.breakdown!.multiplier).toBe(1.5);
    expect(winner.xp).toBe(Math.round((winner.breakdown!.participation + winner.breakdown!.position + winner.breakdown!.podium + winner.breakdown!.personalBest + winner.breakdown!.newTrack) * 1.5));
  });

  it('only admins can mark official events', () => {
    expect(code(() => s.setOfficialEvent(p1Of().id, true))).toBe('admin_only');
  });

  it('with the real 24 h window, organizer results give nothing until final', () => {
    s.db.instantResults = false;
    const p1 = p1Of();
    const before = s.totals(TEST_USER_ID).xp;
    s.submitResults(p1.id, attendedOf(p1.id).map((userId, i) => ({ userId, position: i + 1, laps: 10, bestLapMs: null })), null);
    expect(s.getResults(p1.id)!.status).toBe('pending');
    expect(s.getResults(p1.id)!.entries.every((e) => e.xp === null)).toBe(true);
    expect(s.totals(TEST_USER_ID).xp).toBe(before);
    s.setClockOffset(s.db.clockOffsetMs + 25 * 3_600_000);
    expect(s.getResults(p1.id)!.status).toBe('final');
    expect(s.totals(TEST_USER_ID).xp).toBeGreaterThan(before);
  });

  it('an admin can enter results for any session: final and verified immediately', () => {
    s.db.instantResults = false;
    const p1 = p1Of();
    s.signInAs(ADMIN_USER_ID);
    s.submitResults(p1.id, attendedOf(p1.id).map((userId, i) => ({ userId, position: i + 1, laps: 10, bestLapMs: null })), null);
    expect(s.getResults(p1.id)!).toMatchObject({ status: 'final', source: 'admin' });
  });

  it('rejects invalid laps', () => {
    const p1 = p1Of();
    expect(code(() => s.submitResults(p1.id, attendedOf(p1.id).map((userId, i) => ({ userId, position: i + 1, laps: -2, bestLapMs: null })), null))).toBe('results_bad_laps');
  });
});

describe('self-reported results', () => {
  const report = () => s.selfReport({ trackId: 't-amckart', date: today(), position: 1, fieldSize: 8, laps: 12, bestLapMs: 58_000 });

  it('are unverified: shown in history, no km / XP / rank', () => {
    const before = s.totals(TEST_USER_ID);
    report();
    expect(s.totals(TEST_USER_ID)).toEqual(before);
    const row = s.progressHistory(TEST_USER_ID).find((p) => p.verification === 'unverified' && p.review === 'pending' && p.trackId === 't-amckart')!;
    expect(row).toMatchObject({ source: 'self', xp: null, km: null });
  });

  it('cannot be approved by a lobby organizer or by the driver — only by an admin', () => {
    report();
    const id = s.db.selfReports.at(-1)!.id;
    expect(code(() => s.reviewSelfReport(id, true, 'u-maria'))).toBe('admin_only'); // Maria hosts lobbies
    expect(code(() => s.reviewSelfReport(id, true, TEST_USER_ID))).toBe('admin_only');
    expect(s.db.selfReports.at(-1)!.status).toBe('pending');
  });

  it('admin approval verifies it: km + XP added (and can rank up)', () => {
    const before = s.totals(TEST_USER_ID);
    report();
    const id = s.db.selfReports.at(-1)!.id;
    s.reviewSelfReport(id, true, ADMIN_USER_ID);
    const after = s.totals(TEST_USER_ID);
    expect(after.meters).toBe(before.meters + 12 * 1240);
    expect(after.xp).toBeGreaterThan(before.xp);
    expect(s.rankOf(TEST_USER_ID).key).toBe('contender');
    expect(s.progressHistory(TEST_USER_ID).find((p) => p.review === 'approved')).toMatchObject({ verification: 'verified', source: 'self' });
    expect(code(() => s.reviewSelfReport(id, true, ADMIN_USER_ID))).toBe('already_reviewed');
  });

  it('a rejected self-report gives nothing', () => {
    const before = s.totals(TEST_USER_ID);
    report();
    s.reviewSelfReport(s.db.selfReports.at(-1)!.id, false, ADMIN_USER_ID);
    expect(s.totals(TEST_USER_ID)).toEqual(before);
  });

  it('admins cannot approve their own', () => {
    s.signInAs(ADMIN_USER_ID);
    report();
    expect(code(() => s.reviewSelfReport(s.db.selfReports.at(-1)!.id, true, ADMIN_USER_ID))).toBe('cannot_review_own');
  });

  it('validates the input', () => {
    expect(code(() => s.selfReport({ trackId: 't-amckart', date: '2999-01-01', position: 1, fieldSize: 8, laps: 12, bestLapMs: null }))).toBe('invalid_date');
    expect(code(() => s.selfReport({ trackId: 't-amckart', date: today(), position: 9, fieldSize: 8, laps: 12, bestLapMs: null }))).toBe('results_bad_positions');
    expect(code(() => s.selfReport({ trackId: 't-amckart', date: today(), position: 1, fieldSize: 8, laps: 0, bestLapMs: null }))).toBe('results_bad_laps');
  });
});

describe('ranks are permanent', () => {
  it('never go down, even when the numbers would say a lower rank', () => {
    const u = s.user('u-radu')!;
    const stored = u.rankTierId;
    s.db.ledger = s.db.ledger.filter((l) => l.userId !== 'u-radu'); // e.g. thresholds raised later
    expect(s.rankOf('u-radu').id).toBe(stored);
    expect(s.summary('u-radu').rankTierId).toBe(stored);
  });
});

describe('leaderboards', () => {
  it('rank by XP; the season board only counts XP from that month', () => {
    const all = s.leaderboard({ kind: 'global' });
    expect(all[0]!.user.id).toBe('u-cristian'); // the Veteran
    for (let i = 1; i < all.length; i++) expect(all[i - 1]!.xp).toBeGreaterThanOrEqual(all[i]!.xp);
    const season = s.seasons()[0]!;
    const board = s.leaderboard({ kind: 'season', season });
    const expected = s.db.ledger.filter((l) => l.season === season && l.userId === board[0]!.user.id).reduce((a, l) => a + l.xp, 0);
    expect(board[0]!.xp).toBe(expected);
    expect(board[0]!.xp).toBeLessThan(all.find((e) => e.user.id === board[0]!.user.id)!.xp);
  });
});
