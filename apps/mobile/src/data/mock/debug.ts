/**
 * Commands the preview's debug panel can run against the fake backend.
 * Never shipped with the real backend.
 */
import { renderEmail } from '@config/email-templates';
import { sessionPhase } from '@kartup/domain';
import { ApiError } from '../api';
import { ADMIN_USER_ID, TEST_PASSWORD } from './seed';
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
  return server.db.users.filter((u) => !u.deleted && u.onboardedAt && u.role !== 'admin' && u.id !== server.db.currentUserId && !inLobby.has(u.id) && !server.activeBanOf(u.id) && u.id !== s.hostId);
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
  /** Self-reported results waiting for an admin. */
  selfReports: { id: string; userName: string; label: string }[];
  /** Demo: results final immediately (no 24 h window). */
  instantResults: boolean;
  /** The selected session is an official KartUP event (XP × 1.5). */
  officialSessionIds: string[];
  adminUserId: string;
  testPassword: string;
}

export interface DemoStats {
  users: number;
  onboarded: number;
  hosts: number;
  bannedNow: number;
  sessionsTotal: number;
  upcoming: number;
  awaitingResults: number;
  disputed: number;
  finished: number;
  cancelled: number;
  seatsPaid: number;
  collectedMinor: number;
  refundedMinor: number;
  refunds: number;
  platformFeesMinor: number;
  payoutsMinor: number;
  noShows: number;
  appealsPending: number;
  reportsOpen: number;
  messages: number;
  notifications: number;
  xpAwarded: number;
  kmDriven: number;
  /** Drivers per rank key. */
  tiers: Record<string, number>;
  perTrack: { trackId: string; name: string; sessions: number; upcoming: number; seatsPaid: number; revenueMinor: number }[];
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
      selfReports: db.selfReports
        .filter((r) => r.status === 'pending')
        .map((r) => ({ id: r.id, userName: server.summary(r.userId).firstName, label: `${server.track(r.trackId).name} · P${r.position}/${r.fieldSize} · ${r.laps} laps` })),
      instantResults: db.instantResults,
      officialSessionIds: db.sessions.filter((s) => s.isOfficialEvent).map((s) => s.id),
      adminUserId: ADMIN_USER_ID,
      testPassword: TEST_PASSWORD,
    };
  },

  /** Demo statistics for the developer menu (what the admin dashboard will show later). */
  stats(): DemoStats {
    const db = server.db;
    const users = db.users.filter((u) => !u.deleted);
    const phases: Record<string, number> = {};
    for (const s of db.sessions) {
      const p = server.phase(s);
      phases[p] = (phases[p] ?? 0) + 1;
    }
    const captured = db.payments.filter((p) => p.status === 'captured');
    const refunded = db.payments.filter((p) => p.status === 'refunded');
    const sum = (list: { amountMinor: number }[]) => list.reduce((a, p) => a + p.amountMinor, 0);
    const perTrack = db.tracks
      .map((t) => {
        const sessions = db.sessions.filter((s) => s.trackId === t.id && !s.cancelledAt);
        const ids = new Set(sessions.map((s) => s.id));
        return {
          trackId: t.id,
          name: t.name,
          sessions: sessions.length,
          upcoming: sessions.filter((s) => new Date(s.startsAt).getTime() > server.now().getTime()).length,
          seatsPaid: db.members.filter((m) => ids.has(m.sessionId) && ['confirmed', 'attended', 'no_show'].includes(m.status)).length,
          revenueMinor: sum(captured.filter((p) => ids.has(p.sessionId))),
        };
      })
      .sort((a, b) => b.sessions - a.sessions);
    const tiers: Record<string, number> = {};
    for (const u of users.filter((x) => x.onboardedAt)) {
      const key = server.rankOf(u.id).key;
      tiers[key] = (tiers[key] ?? 0) + 1;
    }
    return {
      users: users.length,
      onboarded: users.filter((u) => u.onboardedAt).length,
      hosts: users.filter((u) => u.payoutsEnabled).length,
      bannedNow: users.filter((u) => server.activeBanOf(u.id)).length,
      sessionsTotal: db.sessions.length,
      upcoming: (phases.open ?? 0) + (phases.locked ?? 0) + (phases.checkin ?? 0),
      awaitingResults: (phases.awaiting_results ?? 0) + (phases.results_pending ?? 0),
      disputed: phases.disputed ?? 0,
      finished: phases.final ?? 0,
      cancelled: phases.cancelled ?? 0,
      seatsPaid: db.members.filter((m) => ['confirmed', 'attended', 'no_show'].includes(m.status)).length,
      collectedMinor: sum(captured),
      refundedMinor: sum(refunded),
      refunds: refunded.length,
      platformFeesMinor: captured.reduce((a, p) => a + p.feeMinor, 0),
      payoutsMinor: db.payouts.reduce((a, p) => a + p.amountMinor, 0),
      noShows: db.noShows.filter((n) => !n.voided).length,
      appealsPending: db.bans.filter((b) => b.appeal?.status === 'pending').length,
      reportsOpen: db.reports.filter((r) => r.status === 'open').length,
      messages: db.messages.filter((m) => !m.system).length,
      notifications: db.notifications.length,
      xpAwarded: db.ledger.reduce((a, l) => a + l.xp, 0),
      kmDriven: Math.round(db.ledger.reduce((a, l) => a + l.meters, 0) / 1000),
      tiers,
      perTrack,
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
  adminDecide(sessionId: string, approve: boolean, falseDispute = false) {
    server.adminDecide(sessionId, approve, falseDispute);
    if (falseDispute) return 'Results approved — disputing driver penalized (false data)';
    return approve ? 'Results approved by admin' : 'Results rejected by admin';
  },
  /** Demo: results final as soon as they are entered (default on), or the real 24 h window. */
  setInstantResults(on: boolean) {
    server.mutate(() => (server.db.instantResults = on));
    return on ? 'Results now final immediately (demo)' : 'Results now wait 24 h for confirmations';
  },
  /** Acts as the demo admin (only admins can approve self-reports). */
  reviewSelfReport(id: string, decision: 'approve' | 'reject' | 'reject_false') {
    server.reviewSelfReport(id, decision, ADMIN_USER_ID);
    return decision === 'approve' ? 'Self-report approved — km and XP added' : decision === 'reject_false' ? 'Rejected as false data — XP penalty' : 'Self-report rejected';
  },
  toggleOfficial(sessionId: string) {
    const s = server.session(sessionId);
    server.setOfficialEvent(sessionId, !s.isOfficialEvent, ADMIN_USER_ID);
    return s.isOfficialEvent ? 'Marked as official KartUP event (XP × 1.5)' : 'No longer an official event';
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
