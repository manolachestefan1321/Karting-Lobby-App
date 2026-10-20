/**
 * Backend-agnostic models used by every screen. Both the mock backend (web preview)
 * and the real Supabase backend return exactly these shapes.
 * Instants are ISO-8601 strings in UTC; calendar dates are "YYYY-MM-DD".
 */
import type { ExperienceLevel, PriceBreakdown, RulesConfig } from '@kartup/domain';

export type Locale = 'en' | 'ro';
export type AuthProvider = 'email' | 'google' | 'apple' | 'facebook';

export interface AuthUser {
  id: string;
  email: string;
  provider: AuthProvider;
}

export interface Profile {
  id: string;
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
  /** Host payout account (Stripe Connect) is verified. Required to create sessions. */
  payoutsEnabled: boolean;
  createdAt: string;
}

export interface BanInfo {
  id: string;
  startsAt: string;
  endsAt: string | null;
  reason: 'no_show' | 'admin';
  offense: number | null;
  appealStatus: 'none' | 'pending' | 'approved' | 'rejected';
}

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  rankTierId: number;
  totalPoints: number;
}

export interface PublicProfile extends UserSummary {
  bio: string;
  homeCityId: string | null;
  age: number | null;
  sessionsRaced: number;
  tracksRaced: number;
  wins: number;
  noShowCount: number;
  createdAt: string;
  activeBan: BanInfo | null;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  countryCode: string;
  timezone: string;
  lat: number;
  lng: number;
}

export interface TrackPrice {
  perDriverMinor: number;
  currency: string;
  updatedAt: string;
  source: 'manual' | 'scrape' | 'api';
  sourceUrl: string | null;
}

export interface Track {
  id: string;
  cityId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  website: string | null;
  phone: string | null;
  openingHours: string;
  kartTypes: string[];
  sessionLengthMin: number;
  maxDrivers: number;
  timezone: string;
  checkinRadiusM: number | null;
  indoor: boolean;
  price: TrackPrice;
}

export interface RankTier {
  id: number;
  key: string;
  min_points: number;
  color: string;
}

export interface TrackExperience {
  trackId: string;
  trackName: string;
  level: ExperienceLevel;
  bestLapMs: number | null;
  sessionsCount: number;
}

export type MemberStatus = 'joined_unpaid' | 'confirmed' | 'attended' | 'no_show' | 'cancelled' | 'removed';
export type ResultsState = 'pending' | 'disputed' | 'final' | 'rejected';

export interface KartSession {
  id: string;
  track: Track;
  host: UserSummary;
  startsAt: string;
  maxDrivers: number;
  minRankTierId: number | null;
  minSkill: ExperienceLevel | null;
  note: string;
  cancelledAt: string | null;
  cancelledBy: 'host' | 'track' | 'admin' | 'system' | null;
  price: PriceBreakdown;
  priceUpdatedAt: string;
  paidCount: number;
  /** Members currently in the lobby (paid + joined-unpaid). */
  memberCount: number;
  resultsStatus: ResultsState | null;
  /** The signed-in user's status in this session, if any. */
  myStatus: MemberStatus | null;
  createdAt: string;
}

export interface LobbyMember extends UserSummary {
  status: MemberStatus;
  isHost: boolean;
  joinedAt: string;
  paidAt: string | null;
  checkedInAt: string | null;
  hostConfirmed: boolean;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  author: UserSummary;
  body: string;
  createdAt: string;
  system?: boolean;
}

export interface ResultsEntry {
  userId: string;
  position: number;
  bestLapMs: number | null;
  points: number | null;
}

export interface SessionResults {
  sessionId: string;
  submittedBy: string;
  submittedAt: string;
  deadline: string;
  status: ResultsState;
  printoutUrl: string | null;
  entries: ResultsEntry[];
  responses: { userId: string; response: 'confirm' | 'dispute'; comment: string | null }[];
}

export type LeaderboardScope =
  | { kind: 'global' }
  | { kind: 'city'; cityId: string }
  | { kind: 'track'; trackId: string }
  | { kind: 'season'; season: string /* YYYY-MM */ };

export interface LeaderboardEntry {
  position: number;
  user: UserSummary;
  points: number;
  sessions: number;
  wins: number;
}

export interface PointsEntry {
  id: string;
  sessionId: string;
  trackName: string;
  date: string;
  position: number;
  fieldSize: number;
  points: number;
}

export type NotificationType =
  | 'lobby_joined'
  | 'lobby_left'
  | 'lobby_full'
  | 'session_cancelled'
  | 'auto_cancelled'
  | 'removed_from_lobby'
  | 'chat_message'
  | 'reminder_cancel_window'
  | 'checkin_open'
  | 'payment_succeeded'
  | 'refund_issued'
  | 'results_posted'
  | 'results_confirmed'
  | 'results_disputed'
  | 'rank_up'
  | 'ban_started'
  | 'ban_ended'
  | 'appeal_resolved'
  | 'payout_sent';

/** Groups the user can switch on/off in Settings. */
export type NotificationGroup = 'lobby' | 'chat' | 'reminders' | 'results' | 'ranking' | 'account';

export interface AppNotification {
  id: string;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
  /** Parameters for the translated text, e.g. { sessionId, trackName, name, amount }. */
  data: Record<string, string | number | null>;
}

export type NotificationPrefs = Record<NotificationGroup, boolean>;

export interface PaymentRecord {
  id: string;
  sessionId: string;
  trackName: string;
  startsAt: string;
  amountMinor: number;
  currency: string;
  status: 'authorized' | 'captured' | 'released' | 'refunded' | 'failed';
  createdAt: string;
  refundedAt: string | null;
}

export interface PaymentIntentInfo {
  paymentId: string;
  /** Stripe client secret in production; opaque token in the preview. */
  clientSecret: string;
  price: PriceBreakdown;
  /** Joining inside the last hour: the seat can't be refunded. */
  nonRefundable: boolean;
}

export type PaymentOutcome =
  | { status: 'seat_confirmed' }
  | { status: 'session_full_released' }
  | { status: 'declined' }
  | { status: 'cancelled' };

export interface SessionFilters {
  cityId: string;
  /** "YYYY-MM-DD" in the city's time zone, or null for all upcoming. */
  date: string | null;
  trackId: string | null;
  skill: ExperienceLevel | null;
  minSpotsLeft: number;
}

export interface CreateSessionInput {
  trackId: string;
  startsAt: string;
  maxDrivers: number;
  minRankTierId: number | null;
  minSkill: ExperienceLevel | null;
  note: string;
}

export type ReportTarget = { kind: 'profile'; userId: string } | { kind: 'message'; messageId: string };

export interface AppRules extends RulesConfig {
  minAge: number;
}
