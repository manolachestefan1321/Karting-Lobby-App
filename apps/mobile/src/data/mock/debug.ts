/**
 * Commands the preview's debug panel can run against the fake backend.
 * Never shipped with the real backend.
 */
import { renderEmail } from '@config/email-templates';
import { sessionPhase } from '@kartup/domain';
import { ApiError } from '../api';
import { TEST_PASSWORD } from './seed';
import { RULES } from './server';
import { server } from './index';

const MIN = 60_000;
const CHAT_LINES = ['On my way! 🏎️', 'Anyone want to carpool from Unirii?', 'Helmet sizes run small here, FYI.', 'Who is taking pole today? 😄', 'Can we do a rolling start?', 'Bringing my brother next time!'];

function randomOf<T>(arr: T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)];
}

function candidates(sessionId: string) {
  const s = server.session(sessionId);
  const inLobby = new Set(server.membersOf(sessionId).filter((m) => m.status !== 'removed' && m.status !== 'cancelled').map((m) => m.userId));
  return server.db.users.filter((u) => !u.deleted && u.onboardedAt && u.id !== server.db.currentUserId && !inLobby.has(u.id) && !server.activeBanOf(u.id) && u.id !== s.hostId);
}

export interface DebugSnapshot {
  now: string;
  offsetMs: number;
  atTrack: boolean;
  currentUserId: string | null;
  users: { id: string; name: string; email: string; banned: boolean }[];
  sessions: { id: string; label: string; startsAt: string; phase: string; myStatus: string | null; isHost: boolean; paid: number; max: number }[];
  emails: { id: string; to: string; kind: 'confirmation' | 'recovery'; subject: string; createdAt: string; opened: boolean }[];
  appeals: { banId: string; userName: string; message: string; status: string }[];
  disputes: { sessionId: string; label: string }[];
  testPassword: string;
}

export const debug = {
  snapshot(): DebugSnapshot {
    const db = server.db;
    const me = db.currentUserId;
    const now = server.now();
    const relevant = db.sessions
      .filter((s) => {
        const t = new Date(s.startsAt).getTime();
        const mine = s.hostId === me || server.membersOf(s.id).some((m) => m.userId === me && m.status !== 'removed');
        return (mine && t > now.getTime() - 3 * 24 * 60 * MIN) || (!s.cancelledAt && t > now.getTime() && t < now.getTime() + 7 * 24 * 60 * MIN);
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return {
      now: now.toISOString(),
      offsetMs: db.clockOffsetMs,
      atTrack: db.simulatedAtTrack,
      currentUserId: me,
      users: db.users
        .filter((u) => !u.deleted)
        .map((u) => ({ id: u.id, name: `${u.firstName ?? '(new)'} ${u.lastName ?? ''}`.trim(), email: u.email, banned: !!server.activeBanOf(u.id) })),
      sessions: relevant.map((s) => ({
        id: s.id,
        label: `${server.track(s.trackId).name} (host ${server.summary(s.hostId).firstName})`,
        startsAt: s.startsAt,
        phase: server.phase(s),
        myStatus: me ? (server.member(s.id, me)?.status ?? null) : null,
        isHost: s.hostId === me,
        paid: server.paidCount(s.id),
        max: s.maxDrivers,
      })),
      emails: db.emails.map((e) => ({ id: e.id, to: e.to, kind: e.kind, subject: renderEmail(e.kind, e.link).subject, createdAt: e.createdAt, opened: e.opened })),
      appeals: db.bans
        .filter((b) => b.appeal)
        .map((b) => ({ banId: b.id, userName: server.summary(b.userId).firstName, message: b.appeal!.message, status: b.appeal!.status })),
      disputes: db.sessions
        .filter((s) => server.phase(s) === 'disputed')
        .map((s) => ({ sessionId: s.id, label: server.track(s.trackId).name })),
      testPassword: TEST_PASSWORD,
    };
  },

  // ── Time ──
  advance(minutes: number) {
    server.setClockOffset(server.db.clockOffsetMs + minutes * MIN);
  },
  resetClock() {
    server.setClockOffset(0);
  },
  /** Jump so that "now" = session start + offsetMinutes (negative = before). */
  jumpToSession(sessionId: string, offsetMinutes: number) {
    const s = server.session(sessionId);
    const target = new Date(s.startsAt).getTime() + offsetMinutes * MIN;
    server.setClockOffset(target - Date.now());
  },

  // ── Users ──
  switchUser(userId: string) {
    server.signInAs(userId);
  },
  signOut() {
    server.signOut();
  },
  setAtTrack(atTrack: boolean) {
    server.mutate(() => (server.db.simulatedAtTrack = atTrack));
  },

  // ── Lobby events (other people) ──
  someoneJoins(sessionId: string) {
    // Try fake users in random order until one meets the session's rank/level requirements.
    for (const u of candidates(sessionId).sort(() => Math.random() - 0.5)) {
      try {
        const intent = server.createIntent(sessionId, u.id);
        server.confirmPayment(intent.paymentId, '4242424242424242', u.id);
        return `${u.firstName} joined and paid`;
      } catch {
        // not eligible — try the next one
      }
    }
    throw new ApiError('no_candidates');
  },
  someoneEntersUnpaid(sessionId: string) {
    for (const u of candidates(sessionId).sort(() => Math.random() - 0.5)) {
      try {
        server.enterLobby(sessionId, u.id);
        return `${u.firstName} entered the lobby (not paid)`;
      } catch {
        // not eligible — try the next one
      }
    }
    throw new ApiError('no_candidates');
  },
  fillLobby(sessionId: string) {
    const s = server.session(sessionId);
    let n = 0;
    while (server.paidCount(sessionId) < s.maxDrivers && n < 20) {
      debug.someoneJoins(sessionId);
      n++;
    }
    return `${n} drivers joined`;
  },
  someoneLeaves(sessionId: string) {
    const s = server.session(sessionId);
    const m = randomOf(server.membersOf(sessionId).filter((x) => x.status === 'confirmed' && x.userId !== s.hostId && x.userId !== server.db.currentUserId));
    if (!m) throw new ApiError('no_candidates');
    server.cancelSeat(sessionId, m.userId);
    return `${server.summary(m.userId).firstName} cancelled (refunded)`;
  },
  someoneChats(sessionId: string) {
    const m = randomOf(server.membersOf(sessionId).filter((x) => (x.status === 'confirmed' || x.status === 'attended') && x.userId !== server.db.currentUserId));
    if (!m) throw new ApiError('no_candidates');
    server.sendMessage(sessionId, randomOf(CHAT_LINES)!, m.userId);
    return `${server.summary(m.userId).firstName} sent a message`;
  },
  hostCancels(sessionId: string) {
    const s = server.session(sessionId);
    server.cancelSession(sessionId, s.hostId === server.db.currentUserId ? 'host' : 'admin', 'debug');
    return 'Session cancelled (everyone refunded)';
  },
  trackCancels(sessionId: string) {
    server.cancelSession(sessionId, 'track', 'Track closed (debug)');
    return 'Track cancelled the session (everyone refunded)';
  },
  othersCheckIn(sessionId: string) {
    const s = server.session(sessionId);
    const phase = sessionPhase({ startsAt: s.startsAt ? new Date(s.startsAt) : 0, cancelled: !!s.cancelledAt }, server.now(), RULES);
    if (phase !== 'checkin') throw new ApiError('too_early');
    server.mutate(() => {
      for (const m of server.membersOf(sessionId)) if (m.status === 'confirmed' && m.userId !== server.db.currentUserId && !m.checkedInAt) m.checkedInAt = server.now().toISOString();
    });
    return 'Everyone else checked in';
  },

  // ── Results ──
  othersRespond(sessionId: string, response: 'confirm' | 'dispute') {
    const r = server.resultsOf(sessionId);
    if (!r) throw new ApiError('not_found');
    let n = 0;
    for (const e of r.entries) {
      if (e.userId === r.submittedBy || e.userId === server.db.currentUserId || r.responses.some((x) => x.userId === e.userId)) continue;
      server.respondResults(sessionId, response, response === 'dispute' ? 'I finished ahead of that driver.' : null, e.userId);
      n++;
      if (response === 'dispute') break;
    }
    return response === 'confirm' ? `${n} drivers confirmed` : 'One driver disputed the results';
  },
  adminDecide(sessionId: string, approve: boolean) {
    server.adminDecide(sessionId, approve);
    return approve ? 'Results approved by admin' : 'Results rejected by admin';
  },
  resolveAppeal(banId: string, approve: boolean) {
    server.resolveAppeal(banId, approve);
    return approve ? 'Appeal approved — ban lifted' : 'Appeal rejected';
  },

  // ── Email inbox ──
  emailHtml(emailId: string) {
    const e = server.db.emails.find((x) => x.id === emailId);
    if (!e) throw new ApiError('not_found');
    server.mutate(() => (e.opened = true));
    return renderEmail(e.kind, e.link).html;
  },
  emailLink(emailId: string) {
    const e = server.db.emails.find((x) => x.id === emailId);
    if (!e) throw new ApiError('not_found');
    return e.link;
  },

  reset() {
    server.reset();
    return 'Demo data reset';
  },
};

export type DebugCommand = keyof typeof debug;
