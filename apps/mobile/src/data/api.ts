/**
 * The contract between screens and the backend. Screens never import a backend
 * directly — only `api` from '@/data'. Today it is backed by the in-browser mock
 * (web preview); later by Supabase + Stripe, with no screen changes.
 *
 * Errors: implementations throw `ApiError` with a stable `code` the app translates
 * (see i18n "errors.*").
 */
import type { ProfileInput, TrackExperienceInput } from '@kartup/domain';
import type {
  AppNotification,
  AppRules,
  AuthProvider,
  AuthUser,
  ChatMessage,
  City,
  CreateSessionInput,
  KartSession,
  LeaderboardEntry,
  LeaderboardScope,
  LobbyMember,
  NotificationPrefs,
  PaymentIntentInfo,
  PaymentOutcome,
  PaymentRecord,
  ProgressEntry,
  Profile,
  PublicProfile,
  RankTier,
  ReportTarget,
  SelfReport,
  SelfReportInput,
  SessionFilters,
  SessionResults,
  Track,
  TrackExperience,
  Locale,
} from './types';

export class ApiError extends Error {
  constructor(
    public code: string,
    public params: Record<string, string | number> = {},
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export type Unsubscribe = () => void;

export interface Clock {
  now(): Date;
  /** Called when the (preview) clock jumps. Real backend: never. */
  subscribe(cb: () => void): Unsubscribe;
}

export interface AuthApi {
  getUser(): Promise<AuthUser | null>;
  onChange(cb: (user: AuthUser | null, event: 'signed_in' | 'signed_out' | 'password_recovery') => void): Unsubscribe;
  signInWithPassword(email: string, password: string): Promise<void>;
  /** Returns needsConfirmation=true when the user must click the email link first. */
  signUp(input: { email: string; password: string; locale: Locale }): Promise<{ needsConfirmation: boolean }>;
  signInWithProvider(provider: Exclude<AuthProvider, 'email'>): Promise<'ok' | 'cancelled'>;
  resendConfirmation(email: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  /** Handles the deep link from an email (confirmation / reset) or OAuth redirect. */
  handleRedirect(params: Record<string, string | undefined>): Promise<'signed_in' | 'password_recovery' | 'confirmed_elsewhere' | 'failed'>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}

export interface ProfilesApi {
  getMine(): Promise<Profile>;
  update(input: Partial<ProfileInput> & { acceptTerms?: boolean; locale?: Locale }): Promise<void>;
  /** `uri` is a local file / blob URI of an already cropped + compressed JPEG. */
  uploadAvatar(uri: string): Promise<void>;
  removeAvatar(): Promise<void>;
  getPublic(userId: string): Promise<PublicProfile | null>;
  listExperience(userId: string): Promise<TrackExperience[]>;
  upsertExperience(input: TrackExperienceInput): Promise<void>;
  deleteExperience(trackId: string): Promise<void>;
  /** Race history: verified results + the user's own self-reports (unverified until an admin approves). */
  progressHistory(userId: string): Promise<ProgressEntry[]>;
  /** Self-report a race result. It is UNVERIFIED: shown in history, gives no km/XP until an admin approves it. */
  selfReport(input: SelfReportInput): Promise<void>;
  /** Host payouts (Stripe Connect Express onboarding). */
  setupPayouts(): Promise<void>;
  appealBan(banId: string, message: string): Promise<void>;
}

export interface PlacesApi {
  rules(): Promise<AppRules>;
  cities(): Promise<City[]>;
  tracks(cityId?: string): Promise<Track[]>;
  track(trackId: string): Promise<Track | null>;
  rankTiers(): Promise<RankTier[]>;
}

export interface SessionsApi {
  list(filters: SessionFilters): Promise<KartSession[]>;
  mine(): Promise<KartSession[]>;
  get(sessionId: string): Promise<KartSession | null>;
  create(input: CreateSessionInput): Promise<KartSession>;
  members(sessionId: string): Promise<LobbyMember[]>;
  /** Enter the lobby without a seat (seat is held only after payment). */
  enterLobby(sessionId: string): Promise<void>;
  leaveLobby(sessionId: string): Promise<void>;
  /** Cancel a PAID seat. Server applies the refund window. */
  cancelSeat(sessionId: string): Promise<{ refunded: boolean }>;
  removeMember(sessionId: string, userId: string): Promise<{ refunded: boolean }>;
  cancelSession(sessionId: string, reason: string): Promise<void>;
  /** Reads the device location itself (preview: simulated from the debug panel) and checks it server-side. */
  checkIn(sessionId: string): Promise<void>;
  confirmAttendance(sessionId: string, userId: string, attended: boolean): Promise<void>;
  messages(sessionId: string): Promise<ChatMessage[]>;
  sendMessage(sessionId: string, body: string): Promise<void>;
}

export interface PaymentsApi {
  /** Server computes the amount from its own price snapshot — never from the client. */
  createIntent(sessionId: string): Promise<PaymentIntentInfo>;
  /**
   * Preview: called by the fake card sheet with the test card number.
   * Production: Stripe PaymentSheet confirms on the device, then the webhook decides.
   */
  confirm(intent: PaymentIntentInfo, testCard: string): Promise<PaymentOutcome>;
  history(): Promise<PaymentRecord[]>;
}

export interface ResultsApi {
  get(sessionId: string): Promise<SessionResults | null>;
  /** Lobby host (or admin): finishing order with laps and best lap per driver. */
  submit(sessionId: string, input: { entries: { userId: string; position: number; laps: number; bestLapMs: number | null }[]; printoutUri: string | null }): Promise<void>;
  respond(sessionId: string, response: 'confirm' | 'dispute', comment?: string): Promise<void>;
}

export interface RankingApi {
  leaderboard(scope: LeaderboardScope): Promise<LeaderboardEntry[]>;
  seasons(): Promise<string[]>;
}

/** KartUP admins only (the server checks the role). */
export interface AdminApi {
  pendingSelfReports(): Promise<SelfReport[]>;
  /** Only admins can approve self-reports (organizers can't: prevents XP farming between friends). */
  reviewSelfReport(id: string, approve: boolean): Promise<void>;
  setOfficialEvent(sessionId: string, official: boolean): Promise<void>;
  /** Sessions an admin may act on: upcoming (official toggle) and those waiting for results. */
  sessions(): Promise<KartSession[]>;
}

export interface NotificationsApi {
  list(): Promise<AppNotification[]>;
  markAllRead(): Promise<void>;
  markRead(id: string): Promise<void>;
  prefs(): Promise<NotificationPrefs>;
  setPrefs(prefs: NotificationPrefs): Promise<void>;
  /** New notifications for the signed-in user, as they happen (in-app banners). */
  onNew(cb: (n: AppNotification) => void): Unsubscribe;
}

export interface ModerationApi {
  report(target: ReportTarget, reason: string): Promise<void>;
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
  blocked(): Promise<string[]>;
}

/** Topics a screen can listen to for live updates. */
export type Topic = 'sessions' | `session:${string}` | 'notifications' | 'leaderboard' | `profile:${string}` | 'me';

export interface RealtimeApi {
  subscribe(topic: Topic, cb: () => void): Unsubscribe;
}

export interface LocationApi {
  /** Current device position (preview: simulated from the debug panel). */
  current(): Promise<{ lat: number; lng: number } | null>;
}

export interface DataApi {
  kind: 'mock' | 'supabase';
  clock: Clock;
  auth: AuthApi;
  profiles: ProfilesApi;
  places: PlacesApi;
  sessions: SessionsApi;
  payments: PaymentsApi;
  results: ResultsApi;
  ranking: RankingApi;
  admin: AdminApi;
  notifications: NotificationsApi;
  moderation: ModerationApi;
  realtime: RealtimeApi;
  location: LocationApi;
}
