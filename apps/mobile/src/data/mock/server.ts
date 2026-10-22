/**
 * The preview's fake backend. It plays the role of the future Supabase database +
 * Edge Functions: every rule is enforced HERE (via @kartup/domain), never in screens.
 *
 * Time comes from a controllable clock (real time + offset) so the debug panel can
 * jump to "59 minutes before start" and the time-based jobs in `tick()` run exactly
 * like the scheduled server jobs will.
 */
import {
  activeBan,
  ageOn,
  autoCancelDue,
  banForNewNoShow,
  canJoinAt,
  checkinClosed,
  checkinDecision,
  checkinWindow,
  DEFAULT_MIN_AGE,
  DEFAULT_RULES,
  fastestLapUserIds,
  hostPayoutMinor,
  hostRemoval,
  isNoShow,
  isOldEnough,
  joinIsNonRefundable,
  participantCancellation,
  MAX_LAPS,
  participantPrice,
  reminderDue,
  resultsDeadline,
  resultsStatus,
  sessionPhase,
  validateFinishingOrder,
  type ExperienceLevel,
} from '@kartup/domain';
import { zonedToUtc } from '@/lib/format';
import { ApiError, type Topic } from '../api';
import type {
  AppNotification,
  AppRules,
  BanInfo,
  ChatMessage,
  CreateSessionInput,
  KartSession,
  LeaderboardEntry,
  LeaderboardScope,
  LobbyMember,
  NotificationGroup,
  NotificationType,
  PaymentIntentInfo,
  PaymentOutcome,
  Profile,
  ProgressEntry,
  PublicProfile,
  SelfReport,
  SelfReportInput,
  SessionFilters,
  SessionResults,
  UserSummary,
} from '../types';
import { RANK_TIERS } from '../ranks';
import { clearDb, loadDb, loadDbAsync, saveDb, type Db, type DbBan, type DbLedger, type DbMember, type DbSession, type DbUser } from './db';
import { rankIdFor, scoreResult, totalsOf, type VerifiedResult } from './progression';
import { DEFAULT_PREFS, seed, TEST_PASSWORD } from './seed';

export { RANK_TIERS };

/** `demoInstantResults` here is only the default; the live value is `db.instantResults`. */
export const RULES: AppRules = { ...DEFAULT_RULES, minAge: DEFAULT_MIN_AGE, demoInstantResults: true };

const GROUP: Record<NotificationType, NotificationGroup> = {
  lobby_joined: 'lobby',
  lobby_left: 'lobby',
  lobby_full: 'lobby',
  session_cancelled: 'account',
  auto_cancelled: 'account',
  removed_from_lobby: 'account',
  chat_message: 'chat',
  reminder_cancel_window: 'reminders',
  checkin_open: 'reminders',
  payment_succeeded: 'account',
  refund_issued: 'account',
  results_posted: 'results',
  results_confirmed: 'results',
  results_disputed: 'results',
  rank_up: 'ranking',
  self_report_reviewed: 'results',
  ban_started: 'account',
  ban_ended: 'account',
  appeal_resolved: 'account',
  payout_sent: 'account',
};

const SKILL_ORDER: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const KEPT = ['confirmed', 'attended', 'no_show'];
const ms = (iso: string) => new Date(iso).getTime();

type Listener = () => void;

export class MockServer {
  db: Db;
  private listeners = new Map<string, Set<Listener>>();
  private notificationListeners = new Set<(n: AppNotification) => void>();
  private authListeners = new Set<(event: 'signed_in' | 'signed_out' | 'password_recovery') => void>();

  /** Resolves once saved demo data has been read back (instant on the web, async on phones). */
  ready: Promise<void>;

  constructor() {
    this.db = loadDb() ?? seed(Date.now());
    this.tick();
    this.save();
    this.ready = loadDbAsync().then((stored) => {
      if (stored) this.db = stored;
      this.tick();
      this.save();
      if (stored) this.emit();
    });
  }

  // ───────────────────────────── infrastructure ─────────────────────────────
  now(): Date {
    return new Date(Date.now() + this.db.clockOffsetMs);
  }
  private iso() {
    return this.now().toISOString();
  }
  private nextId(prefix: string) {
    this.db.seq += 1;
    return `${prefix}-${this.db.seq}`;
  }
  private save() {
    saveDb(this.db);
  }

  on(topic: string, cb: Listener) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic)!.add(cb);
    return () => this.listeners.get(topic)?.delete(cb);
  }
  onNotification(cb: (n: AppNotification) => void) {
    this.notificationListeners.add(cb);
    return () => this.notificationListeners.delete(cb);
  }
  onAuth(cb: (event: 'signed_in' | 'signed_out' | 'password_recovery') => void) {
    this.authListeners.add(cb);
    return () => this.authListeners.delete(cb);
  }
  private emitAuth(event: 'signed_in' | 'signed_out' | 'password_recovery') {
    for (const cb of this.authListeners) cb(event);
  }
  /** Notify every listener: the preview simply refreshes all live data on any change. */
  emit(_topics: Topic[] = []) {
    for (const set of this.listeners.values()) for (const cb of set) cb();
  }

  /** Run a write, then the time-based jobs, persist and broadcast. */
  mutate<T>(fn: () => T): T {
    const result = fn();
    this.tick();
    this.save();
    this.emit();
    return result;
  }

  setClockOffset(offsetMs: number) {
    this.db.clockOffsetMs = offsetMs;
    this.tick();
    this.save();
    this.emit();
  }

  reset() {
    clearDb();
    const keepUser = this.db.currentUserId;
    this.db = seed(Date.now());
    this.db.currentUserId = keepUser && this.db.users.some((u) => u.id === keepUser) ? keepUser : null;
    this.tick();
    this.save();
    this.emit();
    this.emitAuth(this.db.currentUserId ? 'signed_in' : 'signed_out');
  }

  // ───────────────────────────── lookups ─────────────────────────────
  user(id: string): DbUser | undefined {
    return this.db.users.find((u) => u.id === id);
  }
  me(): DbUser {
    const u = this.db.currentUserId ? this.user(this.db.currentUserId) : undefined;
    if (!u || u.deleted) throw new ApiError('unauthorized');
    return u;
  }
  session(id: string): DbSession {
    const s = this.db.sessions.find((x) => x.id === id);
    if (!s) throw new ApiError('not_found');
    return s;
  }
  track(id: string) {
    return this.db.tracks.find((t) => t.id === id)!;
  }
  membersOf(sessionId: string) {
    return this.db.members.filter((m) => m.sessionId === sessionId);
  }
  member(sessionId: string, userId: string) {
    return this.db.members.find((m) => m.sessionId === sessionId && m.userId === userId);
  }
  paidCount(sessionId: string) {
    return this.membersOf(sessionId).filter((m) => KEPT.includes(m.status)).length;
  }
  ledgerOf(userId: string): DbLedger[] {
    return this.db.ledger.filter((l) => l.userId === userId);
  }
  /** Lifetime km / XP / tracks from VERIFIED results only. */
  totals(userId: string) {
    return totalsOf(this.ledgerOf(userId));
  }
  /** Highest rank reached (stored, never goes down). */
  rankOf(userId: string) {
    return RANK_TIERS[(this.user(userId)?.rankTierId ?? 1) - 1]!;
  }
  isAdmin(userId: string | null | undefined) {
    return !!userId && this.user(userId)?.role === 'admin';
  }
  private assertAdmin(userId: string | null | undefined) {
    if (!this.isAdmin(userId)) throw new ApiError('admin_only');
  }
  noShowCount(userId: string) {
    return this.db.noShows.filter((n) => n.userId === userId && !n.voided).length;
  }
  activeBanOf(userId: string): DbBan | null {
    return activeBan(
      this.db.bans.filter((b) => b.userId === userId).map((b) => ({ ...b, startsAt: ms(b.startsAt), endsAt: b.endsAt ? ms(b.endsAt) : null, liftedAt: b.liftedAt ? ms(b.liftedAt) : null, ref: b })),
      this.now(),
    )?.ref ?? null;
  }
  resultsOf(sessionId: string) {
    return this.db.results.find((r) => r.sessionId === sessionId) ?? null;
  }
  private resultsState(sessionId: string) {
    const r = this.resultsOf(sessionId);
    if (!r) return null;
    if (r.finalizedAt) return 'final' as const;
    const st = resultsStatus({
      responses: r.responses,
      respondents: r.entries.map((e) => e.userId).filter((u) => u !== r.submittedBy),
      deadline: ms(r.deadline),
      now: this.now(),
      adminDecision: r.adminDecision,
    });
    return st;
  }
  phase(s: DbSession) {
    const rs = this.resultsState(s.id);
    return sessionPhase(
      { startsAt: ms(s.startsAt), cancelled: !!s.cancelledAt, resultsStatus: rs === 'rejected' ? null : rs },
      this.now(),
      RULES,
    );
  }

  // ───────────────────────────── mappers ─────────────────────────────
  summary(userId: string): UserSummary {
    const u = this.user(userId);
    if (!u || u.deleted) return { id: userId, firstName: 'Deleted', lastName: 'user', avatarUrl: null, rankTierId: 1, totalXp: 0, totalKm: 0 };
    const t = this.totals(userId);
    return { id: u.id, firstName: u.firstName ?? '', lastName: u.lastName ?? '', avatarUrl: u.avatarUrl, rankTierId: u.rankTierId, totalXp: t.xp, totalKm: t.km };
  }
  banInfo(b: DbBan | null): BanInfo | null {
    if (!b) return null;
    return { id: b.id, startsAt: b.startsAt, endsAt: b.endsAt, reason: b.reason, offense: b.offense, appealStatus: b.appeal?.status ?? 'none' };
  }
  profile(u: DbUser): Profile {
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      dateOfBirth: u.dateOfBirth,
      homeCityId: u.homeCityId,
      bio: u.bio,
      avatarUrl: u.avatarUrl,
      locale: u.locale,
      role: u.role,
      termsAcceptedAt: u.termsAcceptedAt,
      onboardedAt: u.onboardedAt,
      payoutsEnabled: u.payoutsEnabled,
      createdAt: u.createdAt,
    };
  }
  publicProfile(userId: string): PublicProfile | null {
    const u = this.user(userId);
    if (!u || u.deleted || !u.onboardedAt) return null;
    const totals = this.totals(userId);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(this.now());
    return {
      ...this.summary(userId),
      bio: u.bio,
      homeCityId: u.homeCityId,
      age: u.dateOfBirth ? ageOn(u.dateOfBirth, today) : null,
      sessionsRaced: totals.sessions,
      tracksRaced: totals.tracks,
      wins: totals.wins,
      noShowCount: this.noShowCount(userId),
      createdAt: u.createdAt,
      activeBan: this.banInfo(this.activeBanOf(userId)),
    };
  }
  kartSession(s: DbSession): KartSession {
    const members = this.membersOf(s.id);
    const meId = this.db.currentUserId;
    const mine = meId ? members.find((m) => m.userId === meId) : undefined;
    return {
      id: s.id,
      track: this.track(s.trackId),
      host: this.summary(s.hostId),
      startsAt: s.startsAt,
      maxDrivers: s.maxDrivers,
      minRankTierId: s.minRankTierId,
      minSkill: s.minSkill,
      note: s.note,
      isOfficialEvent: s.isOfficialEvent,
      cancelledAt: s.cancelledAt,
      cancelledBy: s.cancelledBy,
      price: participantPrice(s.trackPriceMinor, s.feeMinor, s.currency),
      priceUpdatedAt: s.priceUpdatedAt,
      paidCount: members.filter((m) => KEPT.includes(m.status)).length,
      memberCount: members.filter((m) => m.status === 'confirmed' || m.status === 'joined_unpaid').length,
      resultsStatus: this.resultsState(s.id),
      myStatus: mine?.status ?? null,
      createdAt: s.createdAt,
    };
  }
  lobbyMember(m: DbMember, s: DbSession): LobbyMember {
    return {
      ...this.summary(m.userId),
      status: m.status,
      isHost: m.userId === s.hostId,
      joinedAt: m.joinedAt,
      paidAt: m.paidAt,
      checkedInAt: m.checkedInAt,
      hostConfirmed: m.hostConfirmed,
    };
  }

  // ───────────────────────────── notifications ─────────────────────────────
  notify(userId: string, type: NotificationType, data: AppNotification['data'] = {}) {
    const u = this.user(userId);
    if (!u || u.deleted) return;
    if (!u.prefs[GROUP[type]] && GROUP[type] !== 'account') return;
    const n = { id: this.nextId('n'), userId, type, createdAt: this.iso(), readAt: null, data };
    this.db.notifications.push(n);
    if (userId === this.db.currentUserId) {
      const out: AppNotification = { id: n.id, type, createdAt: n.createdAt, readAt: null, data };
      // Deliver after the current mutation finished so banners see fresh data.
      setTimeout(() => this.notificationListeners.forEach((cb) => cb(out)), 0);
    }
  }
  private name(userId: string) {
    const s = this.summary(userId);
    return `${s.firstName} ${s.lastName}`.trim();
  }
  private sessionData(s: DbSession) {
    return { sessionId: s.id, trackName: this.track(s.trackId).name, startsAt: s.startsAt };
  }
  private systemMessage(sessionId: string, userId: string, body: string) {
    this.db.messages.push({ id: this.nextId('m'), sessionId, userId, body, createdAt: this.iso(), system: true });
  }

  // ───────────────────────────── auth ─────────────────────────────
  signIn(email: string, password: string) {
    const u = this.db.users.find((x) => x.email.toLowerCase() === email.toLowerCase() && !x.deleted);
    if (!u || u.password !== password) throw new ApiError('invalid_credentials');
    if (!u.emailConfirmed) throw new ApiError('email_not_confirmed');
    this.db.currentUserId = u.id;
    this.save();
    this.emitAuth('signed_in');
    this.emit();
  }
  signInAs(userId: string) {
    this.db.currentUserId = userId;
    this.save();
    this.emitAuth('signed_in');
    this.emit();
  }
  signOut() {
    this.db.currentUserId = null;
    this.save();
    this.emitAuth('signed_out');
    this.emit();
  }
  private sendEmail(to: string, kind: 'confirmation' | 'recovery', link: string) {
    this.db.emails.unshift({ id: this.nextId('e'), to, kind, link, createdAt: this.iso(), opened: false });
  }
  signUp(email: string, password: string, locale: 'en' | 'ro') {
    const normalized = email.trim().toLowerCase();
    if (this.db.users.some((u) => u.email === normalized && !u.deleted)) throw new ApiError('user_already_exists');
    const id = this.nextId('u');
    this.db.users.push(this.newUser(id, normalized, password, 'email', false, locale, true));
    this.sendEmail(normalized, 'confirmation', `/auth/callback?code=mock-confirm:${id}`);
    this.save();
    this.emit();
  }
  newUser(id: string, email: string, password: string, provider: DbUser['provider'], confirmed: boolean, locale: 'en' | 'ro', acceptedTerms: boolean): DbUser {
    return {
      id,
      email,
      password,
      provider,
      emailConfirmed: confirmed,
      deleted: false,
      firstName: null,
      lastName: null,
      dateOfBirth: null,
      homeCityId: null,
      bio: '',
      avatarUrl: null,
      locale,
      role: 'user',
      termsAcceptedAt: acceptedTerms ? this.iso() : null,
      onboardedAt: null,
      payoutsEnabled: false,
      rankTierId: 1,
      createdAt: this.iso(),
      prefs: { ...DEFAULT_PREFS },
      blocked: [],
    };
  }
  socialSignIn(provider: 'google' | 'apple' | 'facebook') {
    const email = `${provider}.driver@example.com`;
    let u = this.db.users.find((x) => x.email === email && !x.deleted);
    if (!u) {
      u = this.newUser(this.nextId('u'), email, '', provider, true, 'en', false);
      const names = { google: ['Alex', 'Google'], apple: ['Sam', 'Apple'], facebook: ['Robin', 'Facebook'] }[provider];
      u.firstName = names[0]!;
      u.lastName = names[1]!;
      this.db.users.push(u);
    }
    this.db.currentUserId = u.id;
    this.save();
    this.emitAuth('signed_in');
    this.emit();
  }
  resendConfirmation(email: string) {
    const u = this.db.users.find((x) => x.email === email.toLowerCase() && !x.deleted);
    if (u && !u.emailConfirmed) this.sendEmail(u.email, 'confirmation', `/auth/callback?code=mock-confirm:${u.id}`);
    this.save();
    this.emit();
  }
  requestReset(email: string) {
    const u = this.db.users.find((x) => x.email === email.trim().toLowerCase() && !x.deleted);
    if (u) this.sendEmail(u.email, 'recovery', `/auth/callback?code=mock-reset:${u.id}&next=reset-password`);
    this.save();
    this.emit();
  }
  handleRedirect(code: string | undefined): 'signed_in' | 'password_recovery' | 'failed' {
    if (!code) return 'failed';
    const [kind, userId] = code.split(':');
    const u = userId ? this.user(userId) : undefined;
    if (!u || u.deleted) return 'failed';
    if (kind === 'mock-confirm') {
      u.emailConfirmed = true;
      this.db.currentUserId = u.id;
      this.save();
      this.emitAuth('signed_in');
      this.emit();
      return 'signed_in';
    }
    if (kind === 'mock-reset') {
      this.db.currentUserId = u.id;
      this.save();
      this.emitAuth('password_recovery');
      this.emit();
      return 'password_recovery';
    }
    return 'failed';
  }
  updatePassword(password: string) {
    const u = this.me();
    if (u.password === password) throw new ApiError('same_password');
    u.password = password;
    this.save();
  }
  deleteAccount() {
    const u = this.me();
    this.mutate(() => {
      for (const m of this.db.members.filter((x) => x.userId === u.id)) {
        const s = this.session(m.sessionId);
        if (s.cancelledAt || ms(s.startsAt) <= this.now().getTime()) continue;
        if (m.status === 'confirmed') {
          const d = participantCancellation(ms(s.startsAt), this.now(), RULES);
          if (!d.allowed) throw new ApiError('has_locked_session');
          this.refund(m, 'user_cancel');
          m.status = 'cancelled';
        } else if (m.status === 'joined_unpaid') {
          m.status = 'removed';
        }
      }
      for (const p of this.db.payments) if (p.userId === u.id) p.userId = null; // keep for accounting, anonymized
      u.deleted = true;
      u.email = `deleted-${u.id}@invalid`;
      u.firstName = null;
      u.lastName = null;
      u.avatarUrl = null;
      u.bio = '';
      u.dateOfBirth = null;
      this.db.experience = this.db.experience.filter((e) => e.userId !== u.id);
      this.db.currentUserId = null;
    });
    this.emitAuth('signed_out');
  }

  // ───────────────────────────── profile ─────────────────────────────
  updateProfile(input: { firstName?: string; lastName?: string; dateOfBirth?: string; homeCityId?: string; bio?: string; acceptTerms?: boolean; locale?: 'en' | 'ro' }) {
    const u = this.me();
    this.mutate(() => {
      if (input.dateOfBirth !== undefined) {
        if (!isOldEnough(input.dateOfBirth, RULES.minAge, this.now())) throw new ApiError('under_min_age');
        u.dateOfBirth = input.dateOfBirth;
      }
      if (input.firstName !== undefined) u.firstName = input.firstName.trim();
      if (input.lastName !== undefined) u.lastName = input.lastName.trim();
      if (input.homeCityId !== undefined) u.homeCityId = input.homeCityId;
      if (input.bio !== undefined) u.bio = input.bio.trim().slice(0, 280);
      if (input.locale) u.locale = input.locale;
      if (input.acceptTerms) u.termsAcceptedAt = this.iso();
      if (!u.onboardedAt && u.firstName && u.lastName && u.dateOfBirth && u.homeCityId && u.termsAcceptedAt) u.onboardedAt = this.iso();
    });
  }
  setAvatar(url: string | null) {
    const u = this.me();
    this.mutate(() => {
      u.avatarUrl = url;
    });
  }
  setupPayouts() {
    const u = this.me();
    this.mutate(() => {
      u.payoutsEnabled = true;
    });
  }
  appealBan(banId: string, message: string) {
    const u = this.me();
    const b = this.db.bans.find((x) => x.id === banId && x.userId === u.id);
    if (!b) throw new ApiError('not_found');
    if (b.appeal) throw new ApiError('appeal_exists');
    this.mutate(() => {
      b.appeal = { message: message.trim().slice(0, 1000), status: 'pending', createdAt: this.iso() };
    });
  }
  /** Verified results + (for your own history) your self-reports that are still unverified. */
  progressHistory(userId: string): ProgressEntry[] {
    const verified: ProgressEntry[] = this.ledgerOf(userId).map((l) => ({
      id: l.id,
      sessionId: l.sessionId,
      trackId: l.trackId,
      trackName: this.track(l.trackId).name,
      date: l.date,
      position: l.position,
      fieldSize: l.fieldSize,
      laps: l.laps,
      bestLapMs: l.bestLapMs,
      verification: 'verified',
      source: l.source,
      xp: l.xp,
      km: l.meters / 1000,
      breakdown: l.breakdown,
      review: l.selfReportId ? 'approved' : null,
    }));
    const unverified: ProgressEntry[] =
      userId === this.db.currentUserId
        ? this.db.selfReports
            .filter((r) => r.userId === userId && r.status !== 'approved')
            .map((r) => ({
              id: r.id,
              sessionId: null,
              trackId: r.trackId,
              trackName: this.track(r.trackId).name,
              date: r.date,
              position: r.position,
              fieldSize: r.fieldSize,
              laps: r.laps,
              bestLapMs: r.bestLapMs,
              verification: 'unverified',
              source: 'self',
              xp: null,
              km: null,
              breakdown: null,
              review: r.status,
            }))
        : [];
    return [...verified, ...unverified].sort((a, b) => ms(b.date) - ms(a.date));
  }

  /** Self-reported result: stored as UNVERIFIED — no km/XP/rank until an admin approves it. */
  selfReport(input: SelfReportInput) {
    const u = this.me();
    const t = this.db.tracks.find((x) => x.id === input.trackId);
    if (!t) throw new ApiError('not_found');
    const ok = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
    if (!ok(input.fieldSize, 1, 30) || !ok(input.position, 1, input.fieldSize)) throw new ApiError('results_bad_positions');
    if (!ok(input.laps, 1, MAX_LAPS)) throw new ApiError('results_bad_laps');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new ApiError('invalid_date');
    const dayStart = zonedToUtc(input.date, '00:00', t.timezone).getTime();
    const now = this.now().getTime();
    if (dayStart > now || dayStart < now - 366 * 24 * 3_600_000) throw new ApiError('invalid_date');
    // Stored at noon that day (or now, for a race earlier today).
    const date = new Date(Math.min(zonedToUtc(input.date, '12:00', t.timezone).getTime(), now));
    this.mutate(() => {
      this.db.selfReports.push({
        id: this.nextId('sr'),
        userId: u.id,
        trackId: t.id,
        date: date.toISOString(),
        position: input.position,
        fieldSize: input.fieldSize,
        laps: input.laps,
        bestLapMs: input.bestLapMs,
        status: 'pending',
        createdAt: this.iso(),
        reviewedBy: null,
        reviewedAt: null,
      });
    });
  }

  /** Adds a verified result to the ledger and handles a rank-up. */
  private addVerified(r: VerifiedResult) {
    const row = scoreResult(this.db.ledger, r, this.nextId('l'), this.iso());
    this.db.ledger.push(row);
    this.applyRank(r.userId);
    return row;
  }
  /** Ranks are permanent: only ever move up. */
  private applyRank(userId: string) {
    const u = this.user(userId);
    if (!u) return;
    const t = this.totals(userId);
    const reached = rankIdFor(t);
    if (reached > u.rankTierId) {
      u.rankTierId = reached;
      this.notify(userId, 'rank_up', { rank: RANK_TIERS[reached - 1]!.key, rankId: reached, xp: t.xp, km: Math.round(t.km * 10) / 10 });
    }
  }

  // ───────────────────────────── sessions ─────────────────────────────
  listSessions(f: SessionFilters): KartSession[] {
    const now = this.now().getTime();
    const me = this.db.currentUserId ? this.user(this.db.currentUserId) : undefined;
    return this.db.sessions
      .filter((s) => {
        const t = this.track(s.trackId);
        if (t.cityId !== f.cityId || s.cancelledAt || ms(s.startsAt) <= now) return false;
        if (me?.blocked.includes(s.hostId)) return false;
        if (f.trackId && s.trackId !== f.trackId) return false;
        if (f.date) {
          const local = new Intl.DateTimeFormat('en-CA', { timeZone: t.timezone }).format(new Date(s.startsAt));
          if (local !== f.date) return false;
        }
        if (f.skill && s.minSkill && SKILL_ORDER.indexOf(s.minSkill) > SKILL_ORDER.indexOf(f.skill)) return false;
        if (s.maxDrivers - this.paidCount(s.id) < f.minSpotsLeft) return false;
        return true;
      })
      .sort((a, b) => ms(a.startsAt) - ms(b.startsAt))
      .map((s) => this.kartSession(s));
  }
  mySessions(): KartSession[] {
    const me = this.me();
    const ids = new Set(this.db.members.filter((m) => m.userId === me.id && m.status !== 'removed').map((m) => m.sessionId));
    for (const s of this.db.sessions) if (s.hostId === me.id) ids.add(s.id);
    return this.db.sessions.filter((s) => ids.has(s.id)).map((s) => this.kartSession(s));
  }
  private assertCanJoin(s: DbSession, u: DbUser) {
    const ban = this.activeBanOf(u.id);
    if (ban) throw new ApiError('banned', { until: ban.endsAt ?? '' });
    if (s.cancelledAt) throw new ApiError('session_cancelled');
    if (!canJoinAt(ms(s.startsAt), this.now())) throw new ApiError('session_started');
    if (s.minRankTierId && this.rankOf(u.id).id < s.minRankTierId) throw new ApiError('rank_too_low');
    if (s.minSkill) {
      const exp = this.db.experience.find((e) => e.userId === u.id && e.trackId === s.trackId);
      const level = exp?.level ?? 'beginner';
      if (SKILL_ORDER.indexOf(level) < SKILL_ORDER.indexOf(s.minSkill)) throw new ApiError('skill_too_low');
    }
  }
  createSession(input: CreateSessionInput): KartSession {
    const u = this.me();
    if (!u.payoutsEnabled) throw new ApiError('payouts_required');
    const ban = this.activeBanOf(u.id);
    if (ban) throw new ApiError('banned', { until: ban.endsAt ?? '' });
    const t = this.db.tracks.find((x) => x.id === input.trackId);
    if (!t) throw new ApiError('not_found');
    if (input.maxDrivers < RULES.minDrivers || input.maxDrivers > t.maxDrivers) throw new ApiError('invalid_max_drivers', { min: RULES.minDrivers, max: t.maxDrivers });
    const earliest = this.now().getTime() + (RULES.autoCancelBeforeMinutes + 60) * 60_000;
    if (ms(input.startsAt) < earliest) throw new ApiError('start_too_soon', { hours: Math.round((RULES.autoCancelBeforeMinutes + 60) / 60) });
    return this.mutate(() => {
      const s: DbSession = {
        id: this.nextId('s'),
        trackId: t.id,
        hostId: u.id,
        startsAt: new Date(input.startsAt).toISOString(),
        maxDrivers: input.maxDrivers,
        minRankTierId: input.minRankTierId,
        minSkill: input.minSkill,
        note: input.note.trim().slice(0, 300),
        isOfficialEvent: false,
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
        trackPriceMinor: t.price.perDriverMinor,
        feeMinor: RULES.platformFeeMinor,
        currency: t.price.currency,
        priceUpdatedAt: t.price.updatedAt,
        createdAt: this.iso(),
        flags: {},
      };
      this.db.sessions.push(s);
      this.db.members.push({ sessionId: s.id, userId: u.id, status: 'joined_unpaid', joinedAt: this.iso(), paidAt: null, checkedInAt: null, hostConfirmed: false, paymentId: null });
      return this.kartSession(s);
    });
  }
  enterLobby(sessionId: string, userId = this.me().id) {
    const s = this.session(sessionId);
    const u = this.user(userId)!;
    this.assertCanJoin(s, u);
    const existing = this.member(sessionId, userId);
    if (existing && (existing.status === 'confirmed' || existing.status === 'joined_unpaid')) return;
    if (this.paidCount(sessionId) >= s.maxDrivers) throw new ApiError('session_full');
    this.mutate(() => {
      if (existing) {
        existing.status = 'joined_unpaid';
        existing.joinedAt = this.iso();
        existing.paidAt = null;
        existing.paymentId = null;
      } else {
        this.db.members.push({ sessionId, userId, status: 'joined_unpaid', joinedAt: this.iso(), paidAt: null, checkedInAt: null, hostConfirmed: false, paymentId: null });
      }
    });
  }
  leaveLobby(sessionId: string) {
    const me = this.me();
    const m = this.member(sessionId, me.id);
    if (!m || m.status !== 'joined_unpaid') throw new ApiError('not_in_lobby');
    if (this.session(sessionId).hostId === me.id) throw new ApiError('host_cannot_leave');
    this.mutate(() => {
      m.status = 'removed';
    });
  }
  private refund(m: DbMember, _reason: string) {
    const p = this.db.payments.find((x) => x.id === m.paymentId);
    if (p && p.status === 'captured') {
      p.status = 'refunded';
      p.refundedAt = this.iso();
      const s = this.session(m.sessionId);
      this.notify(m.userId, 'refund_issued', { ...this.sessionData(s), amount: p.amountMinor, currency: p.currency });
    }
  }
  cancelSeat(sessionId: string, userId = this.me().id): { refunded: boolean } {
    const s = this.session(sessionId);
    const m = this.member(sessionId, userId);
    if (!m || m.status !== 'confirmed') throw new ApiError('not_paid');
    if (s.hostId === userId) throw new ApiError('host_cannot_leave');
    const d = participantCancellation(ms(s.startsAt), this.now(), RULES);
    if (!d.allowed) throw new ApiError(d.reason);
    this.mutate(() => {
      m.status = 'cancelled';
      this.refund(m, 'user_cancel');
      this.notify(s.hostId, 'lobby_left', { ...this.sessionData(s), name: this.name(userId) });
      this.systemMessage(s.id, userId, 'left');
    });
    return { refunded: true };
  }
  removeMember(sessionId: string, userId: string): { refunded: boolean } {
    const me = this.me();
    const s = this.session(sessionId);
    if (s.hostId !== me.id) throw new ApiError('not_host');
    const m = this.member(sessionId, userId);
    if (!m || (m.status !== 'confirmed' && m.status !== 'joined_unpaid')) throw new ApiError('not_found');
    const d = hostRemoval({ paid: m.status === 'confirmed', isHost: userId === s.hostId }, ms(s.startsAt), this.now());
    if (!d.allowed) throw new ApiError(d.reason);
    this.mutate(() => {
      if (d.refund === 'full') this.refund(m, 'host_removed');
      m.status = 'removed';
      this.notify(userId, 'removed_from_lobby', { ...this.sessionData(s), refunded: d.refund === 'full' ? 1 : 0 });
    });
    return { refunded: d.refund === 'full' };
  }
  cancelSession(sessionId: string, by: 'host' | 'track' | 'admin' | 'system', reason: string) {
    const s = this.session(sessionId);
    if (by === 'host' && s.hostId !== this.me().id) throw new ApiError('not_host');
    if (s.cancelledAt) throw new ApiError('session_cancelled');
    if (by === 'host' && ms(s.startsAt) <= this.now().getTime()) throw new ApiError('already_started');
    this.mutate(() => this.doCancelSession(s, by, reason));
  }
  private doCancelSession(s: DbSession, by: 'host' | 'track' | 'admin' | 'system', reason: string) {
    s.cancelledAt = this.iso();
    s.cancelledBy = by;
    s.cancelReason = reason;
    for (const m of this.membersOf(s.id)) {
      if (m.status === 'confirmed') {
        this.refund(m, `${by}_cancel`);
        m.status = 'cancelled';
        this.notify(m.userId, by === 'system' ? 'auto_cancelled' : 'session_cancelled', { ...this.sessionData(s), by, minDrivers: RULES.minDrivers });
      } else if (m.status === 'joined_unpaid') {
        m.status = 'removed';
        this.notify(m.userId, by === 'system' ? 'auto_cancelled' : 'session_cancelled', { ...this.sessionData(s), by, minDrivers: RULES.minDrivers });
      }
    }
  }

  // ───────────────────────────── payments ─────────────────────────────
  createIntent(sessionId: string, userId = this.me().id): PaymentIntentInfo {
    const s = this.session(sessionId);
    const u = this.user(userId)!;
    this.assertCanJoin(s, u);
    const m = this.member(sessionId, userId);
    if (m?.status === 'confirmed') throw new ApiError('already_paid');
    if (this.paidCount(sessionId) >= s.maxDrivers) throw new ApiError('session_full');
    if (!m || m.status !== 'joined_unpaid') this.enterLobby(sessionId, userId);
    const price = participantPrice(s.trackPriceMinor, s.feeMinor, s.currency);
    const id = this.nextId('p');
    this.db.payments.push({ id, sessionId, userId, amountMinor: price.totalMinor, trackMinor: price.trackMinor, feeMinor: price.feeMinor, currency: price.currency, status: 'pending', createdAt: this.iso(), refundedAt: null });
    this.save();
    return { paymentId: id, clientSecret: `mock_secret_${id}`, price, nonRefundable: joinIsNonRefundable(ms(s.startsAt), this.now(), RULES) };
  }
  /** Mirrors the real flow: authorize the card → lock the session → capture or release. */
  confirmPayment(paymentId: string, card: string, userId = this.me().id): PaymentOutcome {
    const p = this.db.payments.find((x) => x.id === paymentId && x.userId === userId);
    if (!p || p.status !== 'pending') throw new ApiError('not_found');
    const digits = card.replace(/\D/g, '');
    return this.mutate(() => {
      if (digits === '4000000000000002' || digits === '4000000000009995') {
        // Like a Stripe PaymentIntent after a decline: stays open so the user can retry with another card.
        return { status: 'declined' } as const;
      }
      p.status = 'authorized';
      const s = this.session(p.sessionId);
      const m = this.member(s.id, userId);
      if (!m || s.cancelledAt || this.paidCount(s.id) >= s.maxDrivers || !canJoinAt(ms(s.startsAt), this.now())) {
        p.status = 'released';
        return { status: 'session_full_released' } as const;
      }
      p.status = 'captured';
      m.status = 'confirmed';
      m.paidAt = this.iso();
      m.paymentId = p.id;
      this.notify(userId, 'payment_succeeded', { ...this.sessionData(s), amount: p.amountMinor, currency: p.currency });
      if (s.hostId !== userId) this.notify(s.hostId, 'lobby_joined', { ...this.sessionData(s), name: this.name(userId) });
      this.systemMessage(s.id, userId, 'joined');
      if (this.paidCount(s.id) >= s.maxDrivers && !s.flags.fullNotified) {
        s.flags.fullNotified = true;
        for (const x of this.membersOf(s.id)) if (x.status === 'confirmed') this.notify(x.userId, 'lobby_full', this.sessionData(s));
      }
      return { status: 'seat_confirmed' } as const;
    });
  }
  paymentHistory() {
    const me = this.me();
    return this.db.payments
      .filter((p) => p.userId === me.id && p.status !== 'pending')
      .map((p) => {
        const s = this.session(p.sessionId);
        return {
          id: p.id,
          sessionId: p.sessionId,
          trackName: this.track(s.trackId).name,
          startsAt: s.startsAt,
          amountMinor: p.amountMinor,
          currency: p.currency,
          status: p.status as Exclude<typeof p.status, 'pending'>,
          createdAt: p.createdAt,
          refundedAt: p.refundedAt,
        };
      })
      .sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
  }

  // ───────────────────────────── check-in ─────────────────────────────
  simulatedPosition(sessionId?: string) {
    const s = sessionId ? this.session(sessionId) : null;
    const t = s ? this.track(s.trackId) : this.db.tracks[0]!;
    // "At the track" = 60 m away; "away" = ~5 km away.
    return this.db.simulatedAtTrack ? { lat: t.lat + 0.0005, lng: t.lng } : { lat: t.lat + 0.045, lng: t.lng };
  }
  checkIn(sessionId: string, userId = this.me().id) {
    const s = this.session(sessionId);
    const m = this.member(sessionId, userId);
    const t = this.track(s.trackId);
    const d = checkinDecision({
      now: this.now(),
      startsAt: ms(s.startsAt),
      position: this.simulatedPosition(sessionId),
      track: { lat: t.lat, lng: t.lng },
      paid: m?.status === 'confirmed',
      radiusMeters: t.checkinRadiusM,
      rules: RULES,
    });
    if (!d.ok) throw new ApiError(d.reason, d.distance ? { distance: Math.round(d.distance) } : {});
    this.mutate(() => {
      m!.checkedInAt = this.iso();
    });
  }
  confirmAttendance(sessionId: string, userId: string, attended: boolean) {
    const s = this.session(sessionId);
    if (s.hostId !== this.me().id) throw new ApiError('not_host');
    const { opens, closes } = checkinWindow(ms(s.startsAt), RULES);
    const t = this.now().getTime();
    if (t < opens.getTime()) throw new ApiError('too_early');
    if (t >= closes.getTime()) throw new ApiError('too_late');
    const m = this.member(sessionId, userId);
    if (!m || m.status !== 'confirmed') throw new ApiError('not_paid');
    this.mutate(() => {
      m.hostConfirmed = attended;
    });
  }

  // ───────────────────────────── chat ─────────────────────────────
  messages(sessionId: string): ChatMessage[] {
    const me = this.me();
    const m = this.member(sessionId, me.id);
    if (!m && this.session(sessionId).hostId !== me.id) return [];
    return this.db.messages
      .filter((x) => x.sessionId === sessionId && !x.hidden && !me.blocked.includes(x.userId))
      .sort((a, b) => ms(a.createdAt) - ms(b.createdAt))
      .map((x) => ({ id: x.id, sessionId, author: this.summary(x.userId), body: x.body, createdAt: x.createdAt, system: x.system }));
  }
  sendMessage(sessionId: string, body: string, userId = this.me().id) {
    const m = this.member(sessionId, userId);
    if (!m || m.status === 'removed') throw new ApiError('not_in_lobby');
    const text = body.trim().slice(0, 1000);
    if (!text) return;
    const s = this.session(sessionId);
    this.mutate(() => {
      this.db.messages.push({ id: this.nextId('m'), sessionId, userId, body: text, createdAt: this.iso() });
      for (const x of this.membersOf(sessionId)) {
        if (x.userId !== userId && (x.status === 'confirmed' || x.status === 'joined_unpaid')) {
          this.notify(x.userId, 'chat_message', { ...this.sessionData(s), name: this.name(userId), preview: text.slice(0, 80) });
        }
      }
    });
  }

  // ───────────────────────────── results ─────────────────────────────
  getResults(sessionId: string): SessionResults | null {
    const r = this.resultsOf(sessionId);
    if (!r) return null;
    const rows = new Map(this.db.ledger.filter((l) => l.sessionId === sessionId).map((l) => [l.userId, l]));
    return {
      sessionId,
      submittedBy: r.submittedBy,
      submittedAt: r.submittedAt,
      deadline: r.deadline,
      status: this.resultsState(sessionId) ?? 'pending',
      source: r.source,
      printoutUrl: r.printoutUrl,
      entries: [...r.entries]
        .sort((a, b) => a.position - b.position)
        .map((e) => {
          const l = rows.get(e.userId);
          return { ...e, xp: l?.xp ?? null, km: l ? l.meters / 1000 : null, breakdown: l?.breakdown ?? null };
        }),
      responses: r.responses,
    };
  }
  /**
   * The lobby organizer enters results for their own session: VERIFIED once final
   * (after the 24 h confirm/dispute window — or at once in the demo). A KartUP admin
   * can enter results for any session: final immediately.
   */
  submitResults(sessionId: string, entries: { userId: string; position: number; laps: number; bestLapMs: number | null }[], printoutUrl: string | null) {
    const me = this.me();
    const s = this.session(sessionId);
    const asAdmin = s.hostId !== me.id && this.isAdmin(me.id);
    if (s.hostId !== me.id && !asAdmin) throw new ApiError('not_host');
    if (s.cancelledAt) throw new ApiError('session_cancelled');
    if (!checkinClosed(ms(s.startsAt), this.now(), RULES)) throw new ApiError('results_too_early');
    if (this.resultsOf(sessionId)) throw new ApiError('results_exist');
    const attended = this.membersOf(sessionId).filter((m) => m.status === 'attended').map((m) => m.userId);
    const v = validateFinishingOrder(entries, attended);
    if (!v.ok) throw new ApiError(`results_${v.reason}`);
    this.mutate(() => {
      const submittedAt = this.now();
      this.db.results.push({
        sessionId,
        submittedBy: me.id,
        submittedAt: submittedAt.toISOString(),
        deadline: resultsDeadline(submittedAt, RULES).toISOString(),
        source: asAdmin ? 'admin' : 'organizer',
        printoutUrl,
        entries: entries.map((e) => ({ userId: e.userId, position: e.position, laps: e.laps, bestLapMs: e.bestLapMs })),
        responses: [],
        adminDecision: null,
        finalizedAt: null,
      });
      // Admin results, and every result in the demo (so rank-ups show live): final at once.
      if (asAdmin || this.db.instantResults) this.finalize(sessionId);
      else for (const uid of attended) if (uid !== me.id) this.notify(uid, 'results_posted', this.sessionData(s));
    });
  }
  respondResults(sessionId: string, response: 'confirm' | 'dispute', comment: string | null, userId = this.me().id) {
    const r = this.resultsOf(sessionId);
    if (!r) throw new ApiError('not_found');
    if (r.finalizedAt) throw new ApiError('results_final');
    if (r.submittedBy === userId) throw new ApiError('host_cannot_respond');
    if (!r.entries.some((e) => e.userId === userId)) throw new ApiError('not_participant');
    if (r.responses.some((x) => x.userId === userId)) throw new ApiError('already_responded');
    const s = this.session(sessionId);
    this.mutate(() => {
      r.responses.push({ userId, response, comment });
      if (response === 'dispute') this.notify(s.hostId, 'results_disputed', { ...this.sessionData(s), name: this.name(userId) });
    });
  }
  adminDecide(sessionId: string, approve: boolean) {
    const r = this.resultsOf(sessionId);
    if (!r) throw new ApiError('not_found');
    this.mutate(() => {
      r.adminDecision = approve ? 'approved' : 'rejected';
    });
  }
  /** Results became final → they are VERIFIED: km + XP for every classified driver. */
  private finalize(sessionId: string) {
    const r = this.resultsOf(sessionId)!;
    const s = this.session(sessionId);
    const t = this.track(s.trackId);
    r.finalizedAt = this.iso();
    const fastest = r.entries.length > 1 ? fastestLapUserIds(r.entries) : [];
    for (const e of r.entries) {
      const row = this.addVerified({
        userId: e.userId,
        sessionId,
        track: t,
        date: s.startsAt,
        position: e.position,
        fieldSize: r.entries.length,
        laps: e.laps,
        bestLapMs: e.bestLapMs,
        fastestLap: fastest.includes(e.userId),
        officialEvent: s.isOfficialEvent,
        source: r.source,
        verifiedBy: r.submittedBy,
      });
      this.notify(e.userId, 'results_confirmed', { ...this.sessionData(s), xp: row.xp, km: Math.round(row.meters / 100) / 10, position: e.position });
      // Keep self-reported experience in sync with verified sessions.
      const exp = this.db.experience.find((x) => x.userId === e.userId && x.trackId === t.id);
      if (exp) {
        exp.sessionsCount += 1;
        if (e.bestLapMs && (!exp.bestLapMs || e.bestLapMs < exp.bestLapMs)) exp.bestLapMs = e.bestLapMs;
      }
    }
    this.payout(s);
  }
  private payout(s: DbSession) {
    if (s.flags.payoutSent || s.cancelledAt) return;
    s.flags.payoutSent = true;
    const amount = hostPayoutMinor(s.trackPriceMinor, this.membersOf(s.id).map((m) => m.status));
    if (amount <= 0) return;
    this.db.payouts.push({ sessionId: s.id, hostId: s.hostId, amountMinor: amount, createdAt: this.iso() });
    this.notify(s.hostId, 'payout_sent', { ...this.sessionData(s), amount, currency: s.currency });
  }

  // ───────────────────────────── ranking ─────────────────────────────
  leaderboard(scope: LeaderboardScope): LeaderboardEntry[] {
    const rows = this.db.ledger.filter((l) =>
      scope.kind === 'city' ? l.cityId === scope.cityId : scope.kind === 'track' ? l.trackId === scope.trackId : scope.kind === 'season' ? l.season === scope.season : true,
    );
    const by = new Map<string, { xp: number; km: number; sessions: number; wins: number }>();
    for (const l of rows) {
      const u = this.user(l.userId);
      if (!u || u.deleted) continue;
      const a = by.get(l.userId) ?? { xp: 0, km: 0, sessions: 0, wins: 0 };
      a.xp += l.xp;
      a.km += l.meters / 1000;
      a.sessions += 1;
      a.wins += l.position === 1 ? 1 : 0;
      by.set(l.userId, a);
    }
    return [...by.entries()]
      .sort((a, b) => b[1].xp - a[1].xp || b[1].wins - a[1].wins)
      .map(([userId, a], i) => ({ position: i + 1, user: this.summary(userId), ...a }));
  }
  seasons(): string[] {
    return [...new Set(this.db.ledger.map((l) => l.season))].sort().reverse();
  }

  // ───────────────────────────── scheduled jobs ─────────────────────────────
  /** The equivalent of the server's every-minute cron job. Idempotent. */
  tick() {
    const now = this.now().getTime();
    for (const s of this.db.sessions) {
      if (s.cancelledAt) continue;
      const start = ms(s.startsAt);
      const paid = this.paidCount(s.id);
      // From 3 h before start until the start: fewer than 4 paid drivers → cancel + refund everyone.
      // (Also catches a clock jump straight past the start, before check-in was processed.)
      if (!s.flags.noShowsProcessed && autoCancelDue(start, paid, now, RULES)) {
        this.doCancelSession(s, 'system', 'min_drivers');
        continue;
      }
      if (!s.flags.reminderSent && reminderDue(start, now, RULES)) {
        s.flags.reminderSent = true;
        for (const m of this.membersOf(s.id)) {
          if (m.status === 'confirmed') this.notify(m.userId, 'reminder_cancel_window', { ...this.sessionData(s), cancelUntil: new Date(start - RULES.cancelRefundCutoffMinutes * 60_000).toISOString() });
        }
      }
      const win = checkinWindow(start, RULES);
      if (!s.flags.checkinNotified && now >= win.opens.getTime()) {
        s.flags.checkinNotified = true;
        // Preview realism: the fake drivers arrive and check in. Only the signed-in tester can be a no-show.
        for (const m of this.membersOf(s.id)) {
          if (m.status === 'confirmed' && m.userId !== this.db.currentUserId && !m.checkedInAt) m.checkedInAt = new Date(Math.min(now, win.opens.getTime() + 5 * 60_000)).toISOString();
        }
        if (now < win.closes.getTime()) for (const m of this.membersOf(s.id)) if (m.status === 'confirmed') this.notify(m.userId, 'checkin_open', this.sessionData(s));
      }
      if (!s.flags.lobbyClosed && now >= start) {
        s.flags.lobbyClosed = true;
        for (const m of this.membersOf(s.id)) if (m.status === 'joined_unpaid') m.status = 'removed';
      }
      if (!s.flags.noShowsProcessed && now >= win.closes.getTime()) {
        s.flags.noShowsProcessed = true;
        for (const m of this.membersOf(s.id)) {
          if (m.status !== 'confirmed') continue;
          if (isNoShow({ paid: true, checkedIn: !!m.checkedInAt, hostConfirmed: m.hostConfirmed })) {
            m.status = 'no_show';
            const previous = this.noShowCount(m.userId);
            const nsId = this.nextId('ns');
            this.db.noShows.push({ id: nsId, userId: m.userId, sessionId: s.id, createdAt: new Date(win.closes).toISOString(), voided: false });
            const ban = banForNewNoShow(previous, win.closes, RULES.banLadder);
            this.db.bans.push({ id: this.nextId('b'), userId: m.userId, startsAt: ban.startsAt.toISOString(), endsAt: ban.endsAt.toISOString(), reason: 'no_show', offense: ban.offense, noShowId: nsId, liftedAt: null, endNotified: false, appeal: null });
            this.notify(m.userId, 'ban_started', { ...this.sessionData(s), endsAt: ban.endsAt.toISOString(), offense: ban.offense });
          } else {
            m.status = 'attended';
          }
        }
      }
      const r = this.resultsOf(s.id);
      if (r && !r.finalizedAt) {
        const st = this.resultsState(s.id);
        if (st === 'final') this.finalize(s.id);
      }
      if (!s.flags.payoutSent && s.flags.noShowsProcessed && now >= start + 24 * 3_600_000 && this.resultsState(s.id) !== 'disputed') this.payout(s);
    }
    for (const b of this.db.bans) {
      if (!b.endNotified && !b.liftedAt && b.endsAt && ms(b.endsAt) <= now) {
        b.endNotified = true;
        this.notify(b.userId, 'ban_ended', {});
      }
    }
  }

  // ───────────────────────────── admin ─────────────────────────────
  pendingSelfReports(actorId = this.me().id): SelfReport[] {
    this.assertAdmin(actorId);
    return this.db.selfReports
      .filter((r) => r.status === 'pending')
      .sort((a, b) => ms(a.createdAt) - ms(b.createdAt))
      .map((r) => ({
        id: r.id,
        user: this.summary(r.userId),
        trackId: r.trackId,
        trackName: this.track(r.trackId).name,
        date: r.date,
        position: r.position,
        fieldSize: r.fieldSize,
        laps: r.laps,
        bestLapMs: r.bestLapMs,
        status: r.status,
        createdAt: r.createdAt,
      }));
  }
  /**
   * ONLY admins can approve self-reports — not lobby organizers — so friends can't
   * farm XP by approving each other. Approved → verified → km + XP.
   */
  reviewSelfReport(id: string, approve: boolean, actorId = this.me().id) {
    this.assertAdmin(actorId);
    const r = this.db.selfReports.find((x) => x.id === id);
    if (!r) throw new ApiError('not_found');
    if (r.status !== 'pending') throw new ApiError('already_reviewed');
    if (r.userId === actorId) throw new ApiError('cannot_review_own');
    this.mutate(() => {
      r.status = approve ? 'approved' : 'rejected';
      r.reviewedBy = actorId;
      r.reviewedAt = this.iso();
      const t = this.track(r.trackId);
      if (approve) {
        this.addVerified({
          userId: r.userId,
          sessionId: null,
          track: t,
          date: r.date,
          position: r.position,
          fieldSize: r.fieldSize,
          laps: r.laps,
          bestLapMs: r.bestLapMs,
          fastestLap: false,
          officialEvent: false,
          source: 'self',
          verifiedBy: actorId,
          selfReportId: r.id,
        });
      }
      this.notify(r.userId, 'self_report_reviewed', { approved: approve ? 1 : 0, trackName: t.name });
    });
  }
  setOfficialEvent(sessionId: string, official: boolean, actorId = this.me().id) {
    this.assertAdmin(actorId);
    const s = this.session(sessionId);
    if (this.resultsOf(sessionId)) throw new ApiError('results_exist');
    this.mutate(() => {
      s.isOfficialEvent = official;
    });
  }
  adminSessions(actorId = this.me().id): KartSession[] {
    this.assertAdmin(actorId);
    return this.db.sessions
      .filter((s) => ['open', 'locked', 'checkin', 'awaiting_results'].includes(this.phase(s)))
      .sort((a, b) => ms(a.startsAt) - ms(b.startsAt))
      .map((s) => this.kartSession(s));
  }

  // ───────────────────────────── admin (used by the debug panel) ─────────────────────────────
  resolveAppeal(banId: string, approve: boolean) {
    const b = this.db.bans.find((x) => x.id === banId);
    if (!b?.appeal) throw new ApiError('not_found');
    this.mutate(() => {
      b.appeal!.status = approve ? 'approved' : 'rejected';
      if (approve) {
        b.liftedAt = this.iso();
        b.endNotified = true;
        const ns = this.db.noShows.find((n) => n.id === b.noShowId);
        if (ns) ns.voided = true;
      }
      this.notify(b.userId, 'appeal_resolved', { approved: approve ? 1 : 0 });
    });
  }

  static readonly testPassword = TEST_PASSWORD;
}
