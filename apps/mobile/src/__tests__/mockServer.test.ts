/**
 * Integration tests of the preview backend: the same flows the debug panel drives.
 * They exercise the shared business rules end-to-end (join → pay → cancel → refund,
 * auto-cancel, no-show → ban, results → points → rank-up).
 */
import { beforeEach, describe, expect, it } from '@jest/globals';
import { MockServer } from '@/data/mock/server';
import { TEST_USER_ID } from '@/data/mock/seed';

const MIN = 60_000;
let s: MockServer;

function sessionByHost(hostId: string, pred: (startsAt: number) => boolean = () => true) {
  return s.db.sessions.find((x) => x.hostId === hostId && pred(new Date(x.startsAt).getTime()))!;
}
function jumpTo(sessionId: string, offsetMin: number) {
  const start = new Date(s.session(sessionId).startsAt).getTime();
  s.setClockOffset(start + offsetMin * MIN - Date.now());
}
const now = () => s.now().getTime();
const myNotifications = () => s.db.notifications.filter((n) => n.userId === TEST_USER_ID).map((n) => n.type);

beforeEach(() => {
  s = new MockServer();
  s.reset();
  s.signInAs(TEST_USER_ID);
});

describe('join, pay and cancel', () => {
  it('holds a seat only after payment and refunds a cancellation more than 1 h before start', () => {
    const u1 = sessionByHost('u-maria', (t) => t > now());
    const before = s.paidCount(u1.id);
    const intent = s.createIntent(u1.id);
    expect(intent.price.totalMinor).toBe(u1.trackPriceMinor + 500);
    expect(s.member(u1.id, TEST_USER_ID)?.status).toBe('joined_unpaid');
    expect(s.paidCount(u1.id)).toBe(before);

    expect(s.confirmPayment(intent.paymentId, '4242 4242 4242 4242')).toEqual({ status: 'seat_confirmed' });
    expect(s.paidCount(u1.id)).toBe(before + 1);

    expect(s.cancelSeat(u1.id)).toEqual({ refunded: true });
    const payment = s.db.payments.find((p) => p.id === intent.paymentId)!;
    expect(payment.status).toBe('refunded');
    expect(myNotifications()).toContain('refund_issued');
  });

  it('refuses cancellation inside the last hour', () => {
    const u1 = sessionByHost('u-maria', (t) => t > now());
    s.confirmPayment(s.createIntent(u1.id).paymentId, '4242424242424242');
    jumpTo(u1.id, -59);
    expect(() => s.cancelSeat(u1.id)).toThrow('inside_last_hour');
  });

  it('a declined card does not take a seat', () => {
    const u1 = sessionByHost('u-maria', (t) => t > now());
    const intent = s.createIntent(u1.id);
    expect(s.confirmPayment(intent.paymentId, '4000 0000 0000 0002')).toEqual({ status: 'declined' });
    expect(s.member(u1.id, TEST_USER_ID)?.status).toBe('joined_unpaid');
    // retrying the same payment with a working card succeeds
    expect(s.confirmPayment(intent.paymentId, '4242 4242 4242 4242')).toEqual({ status: 'seat_confirmed' });
  });

  it('releases the authorization (no charge) if the last seat was taken meanwhile', () => {
    const u2 = sessionByHost('u-radu', (t) => t > now()); // 7/8 paid, intermediate+
    s.mutate(() => {
      s.db.experience = s.db.experience.filter((e) => !(e.userId === 'u-bianca' && e.trackId === u2.trackId));
      s.db.experience.push({ userId: 'u-bianca', trackId: u2.trackId, level: 'advanced', bestLapMs: null, sessionsCount: 1 });
    });
    const intent = s.createIntent(u2.id);
    // someone else grabs the last seat first
    const other = s.createIntent(u2.id, 'u-bianca');
    s.confirmPayment(other.paymentId, '4242424242424242', 'u-bianca');
    expect(s.confirmPayment(intent.paymentId, '4242424242424242')).toEqual({ status: 'session_full_released' });
    expect(s.db.payments.find((p) => p.id === intent.paymentId)!.status).toBe('released');
  });

  it('host removal of a paid driver refunds them', () => {
    const u3 = sessionByHost(TEST_USER_ID, (t) => t > now());
    expect(s.removeMember(u3.id, 'u-elena')).toEqual({ refunded: true });
    expect(s.removeMember(u3.id, 'u-ioana')).toEqual({ refunded: false }); // unpaid
  });
});

describe('scheduled rules', () => {
  it('auto-cancels and refunds a session with fewer than 4 paid drivers 3 h before start', () => {
    const u3 = sessionByHost(TEST_USER_ID, (t) => t > now());
    jumpTo(u3.id, -181);
    expect(s.session(u3.id).cancelledAt).toBeNull();
    jumpTo(u3.id, -179);
    expect(s.session(u3.id).cancelledBy).toBe('system');
    expect(s.db.payments.filter((p) => p.sessionId === u3.id).every((p) => p.status === 'refunded')).toBe(true);
    expect(myNotifications()).toContain('auto_cancelled');
  });

  it('sends the 2 h reminder once', () => {
    const u1 = sessionByHost('u-maria', (t) => t > now());
    s.confirmPayment(s.createIntent(u1.id).paymentId, '4242424242424242');
    jumpTo(u1.id, -119);
    jumpTo(u1.id, -100);
    const reminders = s.db.notifications.filter((n) => n.userId === TEST_USER_ID && n.type === 'reminder_cancel_window' && n.data.sessionId === u1.id);
    expect(reminders).toHaveLength(1);
  });

  it('marks a no-show and applies the 1 h ban (first offense); checked-in drivers attend', () => {
    const u4 = sessionByHost('u-vlad', (t) => t > now());
    jumpTo(u4.id, 16);
    expect(s.member(u4.id, TEST_USER_ID)!.status).toBe('no_show');
    expect(s.member(u4.id, 'u-ana')!.status).toBe('attended');
    const ban = s.activeBanOf(TEST_USER_ID)!;
    expect(new Date(ban.endsAt!).getTime() - new Date(ban.startsAt).getTime()).toBe(60 * MIN);
    // banned users cannot join
    const u1 = sessionByHost('u-maria', (t) => t > now());
    expect(() => s.createIntent(u1.id)).toThrow('banned');
  });

  it('checking in avoids the no-show', () => {
    const u4 = sessionByHost('u-vlad', (t) => t > now());
    jumpTo(u4.id, -10);
    s.checkIn(u4.id);
    jumpTo(u4.id, 16);
    expect(s.member(u4.id, TEST_USER_ID)!.status).toBe('attended');
    expect(s.activeBanOf(TEST_USER_ID)).toBeNull();
  });

  it('check-in fails when away from the track', () => {
    const u4 = sessionByHost('u-vlad', (t) => t > now());
    jumpTo(u4.id, -10);
    s.mutate(() => (s.db.simulatedAtTrack = false));
    expect(() => s.checkIn(u4.id)).toThrow('too_far');
  });
});

describe('results', () => {
  it('pending results stay pending until confirmed or 24 h pass', () => {
    const p2 = s.db.sessions.find((x) => x.hostId === 'u-radu' && s.resultsOf(x.id) && !s.resultsOf(x.id)!.finalizedAt)!;
    expect(s.getResults(p2.id)!.status).toBe('pending');
    s.setClockOffset(75 * MIN);
    expect(s.getResults(p2.id)!.status).toBe('pending');
    s.respondResults(p2.id, 'confirm', null);
    expect(s.getResults(p2.id)!.status).toBe('final');
  });

  it('host enters results; once everyone confirms, points are awarded and the rank goes up', () => {
    const p1 = s.db.sessions.find((x) => x.hostId === TEST_USER_ID && new Date(x.startsAt).getTime() < now() && !s.resultsOf(x.id))!;
    const attended = s.membersOf(p1.id).filter((m) => m.status === 'attended').map((m) => m.userId);
    const before = s.totalPoints(TEST_USER_ID);
    expect(before).toBeLessThan(1000);
    s.submitResults(p1.id, attended.map((userId, i) => ({ userId, position: i + 1, bestLapMs: null })), null);
    for (const uid of attended.filter((u) => u !== TEST_USER_ID)) s.respondResults(p1.id, 'confirm', null, uid);
    expect(s.getResults(p1.id)!.status).toBe('final');
    expect(s.totalPoints(TEST_USER_ID)).toBe(before + 81);
    expect(myNotifications()).toContain('rank_up');
    expect(myNotifications()).toContain('payout_sent');
  });

  it('a dispute sends results to admin review', () => {
    const p2 = s.db.sessions.find((x) => x.hostId === 'u-radu' && s.resultsOf(x.id) && !s.resultsOf(x.id)!.finalizedAt)!;
    s.respondResults(p2.id, 'dispute', 'wrong order');
    expect(s.getResults(p2.id)!.status).toBe('disputed');
    s.setClockOffset(2 * 24 * 60 * MIN);
    expect(s.getResults(p2.id)!.status).toBe('disputed');
    s.adminDecide(p2.id, true);
    expect(s.getResults(p2.id)!.status).toBe('final');
  });
});

describe('seeded tracks', () => {
  it('uses real tracks whose prices are marked "to verify" and link to a source', () => {
    expect(s.db.tracks.length).toBeGreaterThanOrEqual(8);
    for (const t of s.db.tracks) {
      expect(t.price.verified).toBe(false);
      expect(t.price.sourceUrl).toMatch(/^https:\/\//);
      expect(Number.isInteger(t.price.perDriverMinor)).toBe(true);
    }
  });
});

describe('demo data persistence (phones)', () => {
  it('keeps the signed-in user and changes after the app restarts', async () => {
    const first = new MockServer();
    await first.ready;
    first.signInAs(TEST_USER_ID);
    first.setupPayouts();
    await new Promise((r) => setTimeout(r, 300)); // let the debounced save run
    const second = new MockServer();
    await second.ready;
    expect(second.db.currentUserId).toBe(TEST_USER_ID);
    expect(second.me().payoutsEnabled).toBe(true);
  });
});
