/**
 * In-memory "database" of the web preview, persisted to localStorage so data
 * survives reloads. Shapes loosely mirror the real Postgres tables.
 */
import type { ExperienceLevel } from '@kartup/domain';
import type { AuthProvider, City, Locale, MemberStatus, NotificationPrefs, NotificationType, Track } from '../types';

export interface DbUser {
  id: string;
  email: string;
  password: string;
  provider: AuthProvider;
  emailConfirmed: boolean;
  deleted: boolean;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  homeCityId: string | null;
  bio: string;
  avatarUrl: string | null;
  locale: Locale;
  role: 'user' | 'admin';
  termsAcceptedAt: string | null;
  onboardedAt: string | null;
  payoutsEnabled: boolean;
  createdAt: string;
  prefs: NotificationPrefs;
  blocked: string[];
}

export interface DbSession {
  id: string;
  trackId: string;
  hostId: string;
  startsAt: string;
  maxDrivers: number;
  minRankTierId: number | null;
  minSkill: ExperienceLevel | null;
  note: string;
  cancelledAt: string | null;
  cancelledBy: 'host' | 'track' | 'admin' | 'system' | null;
  cancelReason: string | null;
  trackPriceMinor: number;
  feeMinor: number;
  currency: string;
  priceUpdatedAt: string;
  createdAt: string;
  flags: { reminderSent?: boolean; checkinNotified?: boolean; noShowsProcessed?: boolean; payoutSent?: boolean; fullNotified?: boolean; lobbyClosed?: boolean };
}

export interface DbMember {
  sessionId: string;
  userId: string;
  status: MemberStatus;
  joinedAt: string;
  paidAt: string | null;
  checkedInAt: string | null;
  hostConfirmed: boolean;
  paymentId: string | null;
}

export interface DbPayment {
  id: string;
  sessionId: string;
  userId: string | null;
  amountMinor: number;
  trackMinor: number;
  feeMinor: number;
  currency: string;
  status: 'pending' | 'authorized' | 'captured' | 'released' | 'refunded' | 'failed';
  createdAt: string;
  refundedAt: string | null;
}

export interface DbMessage {
  id: string;
  sessionId: string;
  userId: string;
  body: string;
  createdAt: string;
  system?: boolean;
  hidden?: boolean;
}

export interface DbResults {
  sessionId: string;
  submittedBy: string;
  submittedAt: string;
  deadline: string;
  printoutUrl: string | null;
  entries: { userId: string; position: number; bestLapMs: number | null }[];
  responses: { userId: string; response: 'confirm' | 'dispute'; comment: string | null }[];
  adminDecision: 'approved' | 'rejected' | null;
  finalizedAt: string | null;
}

export interface DbLedger {
  id: string;
  userId: string;
  sessionId: string;
  trackId: string;
  cityId: string;
  season: string;
  points: number;
  position: number;
  fieldSize: number;
  createdAt: string;
}

export interface DbBan {
  id: string;
  userId: string;
  startsAt: string;
  endsAt: string | null;
  reason: 'no_show' | 'admin';
  offense: number | null;
  noShowId: string | null;
  liftedAt: string | null;
  endNotified: boolean;
  appeal: { message: string; status: 'pending' | 'approved' | 'rejected'; createdAt: string } | null;
}

export interface DbNoShow {
  id: string;
  userId: string;
  sessionId: string;
  createdAt: string;
  voided: boolean;
}

export interface DbNotification {
  id: string;
  userId: string;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
  data: Record<string, string | number | null>;
}

export interface DbEmail {
  id: string;
  to: string;
  kind: 'confirmation' | 'recovery';
  link: string;
  createdAt: string;
  opened: boolean;
}

export interface DbReport {
  id: string;
  reporterId: string;
  target: { kind: 'profile'; userId: string } | { kind: 'message'; messageId: string };
  reason: string;
  createdAt: string;
  status: 'open' | 'closed';
}

export interface DbExperience {
  userId: string;
  trackId: string;
  level: ExperienceLevel;
  bestLapMs: number | null;
  sessionsCount: number;
}

export interface DbPayout {
  sessionId: string;
  hostId: string;
  amountMinor: number;
  createdAt: string;
}

export interface Db {
  version: number;
  seededAt: string;
  clockOffsetMs: number;
  currentUserId: string | null;
  simulatedAtTrack: boolean;
  seq: number;
  cities: City[];
  tracks: Track[];
  users: DbUser[];
  sessions: DbSession[];
  members: DbMember[];
  payments: DbPayment[];
  messages: DbMessage[];
  results: DbResults[];
  ledger: DbLedger[];
  bans: DbBan[];
  noShows: DbNoShow[];
  notifications: DbNotification[];
  emails: DbEmail[];
  reports: DbReport[];
  experience: DbExperience[];
  payouts: DbPayout[];
}

export const DB_VERSION = 5; // bump when the seed changes: browsers then reload fresh demo data
const KEY = 'kartup-preview-db';

export function loadDb(): Db | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const db = JSON.parse(raw) as Db;
    return db.version === DB_VERSION ? db : null;
  } catch {
    return null;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function saveDb(db: Db) {
  if (typeof localStorage === 'undefined') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      // Storage full or blocked — the preview keeps working in memory.
    }
  }, 200);
}

export function clearDb() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
