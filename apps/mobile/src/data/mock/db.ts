import AsyncStorage from '@react-native-async-storage/async-storage';
/**
 * In-memory "database" of the web preview, persisted to localStorage so data
 * survives reloads. Shapes loosely mirror the real Postgres tables.
 */
import type { ExperienceLevel, XpBreakdown } from '@kartup/domain';
import type { AuthProvider, City, Locale, MemberStatus, NotificationPrefs, NotificationType, ResultSource, Track } from '../types';

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
  /** Highest rank reached (1 = Rookie). Stored so it never goes down. */
  rankTierId: number;
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
  isOfficialEvent: boolean;
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
  /** Host of the lobby, or a KartUP admin. */
  source: 'organizer' | 'admin';
  printoutUrl: string | null;
  entries: { userId: string; position: number; laps: number; bestLapMs: number | null }[];
  responses: { userId: string; response: 'confirm' | 'dispute'; comment: string | null }[];
  adminDecision: 'approved' | 'rejected' | null;
  finalizedAt: string | null;
}

/**
 * Progression ledger: one row per driver per VERIFIED result. Totals (km, XP, tracks
 * visited) are sums over these rows. Unverified self-reports never get a row.
 */
export interface DbLedger {
  id: string;
  userId: string;
  /** Lobby session, or null for timing-sheet imports and approved self-reports. */
  sessionId: string | null;
  trackId: string;
  cityId: string;
  /** Race start (ISO). */
  date: string;
  /** "YYYY-MM" in the track's time zone (seasonal leaderboards). */
  season: string;
  position: number;
  fieldSize: number;
  laps: number;
  bestLapMs: number | null;
  meters: number;
  xp: number;
  breakdown: XpBreakdown;
  source: ResultSource;
  /** Who verified it: host, admin, or null for timing sheets. */
  verifiedBy: string | null;
  /** Self-report this row came from (approved by an admin). */
  selfReportId?: string;
  createdAt: string;
}

/** Self-reported result: UNVERIFIED, no progression until an admin approves it. */
export interface DbSelfReport {
  id: string;
  userId: string;
  trackId: string;
  /** Race start (ISO, noon local time of the reported day). */
  date: string;
  position: number;
  fieldSize: number;
  laps: number;
  bestLapMs: number | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
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
  selfReports: DbSelfReport[];
  /** Demo: results are final as soon as they are entered (skip the 24 h dispute window). */
  instantResults: boolean;
  bans: DbBan[];
  noShows: DbNoShow[];
  notifications: DbNotification[];
  emails: DbEmail[];
  reports: DbReport[];
  experience: DbExperience[];
  payouts: DbPayout[];
}

export const DB_VERSION = 9; // bump when the seed changes: browsers then reload fresh demo data
const KEY = 'kartup-preview-db';

/**
 * Where the demo data is kept:
 *  - web preview: localStorage (synchronous);
 *  - iPhone / Android demo: AsyncStorage (asynchronous — loaded with loadDbAsync()).
 */
const hasLocalStorage = typeof localStorage !== 'undefined';
/** On the phone, never write before the saved data was read back (it would be overwritten). */
let nativeLoaded = hasLocalStorage;

function parse(raw: string | null): Db | null {
  if (!raw) return null;
  try {
    const db = JSON.parse(raw) as Db;
    return db.version === DB_VERSION ? db : null;
  } catch {
    return null;
  }
}

export function loadDb(): Db | null {
  if (!hasLocalStorage) return null;
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export async function loadDbAsync(): Promise<Db | null> {
  if (hasLocalStorage) return null;
  try {
    return parse(await AsyncStorage.getItem(KEY));
  } catch {
    return null;
  } finally {
    nativeLoaded = true;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function saveDb(db: Db) {
  if (!nativeLoaded) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const raw = JSON.stringify(db);
    if (hasLocalStorage) {
      try {
        localStorage.setItem(KEY, raw);
      } catch {
        // Storage full or blocked — the demo keeps working in memory.
      }
    } else {
      AsyncStorage.setItem(KEY, raw).catch(() => undefined);
    }
  }, 200);
}

export function clearDb() {
  if (hasLocalStorage) {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  } else {
    AsyncStorage.removeItem(KEY).catch(() => undefined);
  }
}
