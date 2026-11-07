/**
 * Real backend: tracks, sessions and lobbies (step 1 of the core loop).
 * Reads come from the views `track_details`, `session_cards` and `lobby_members`;
 * every change goes through a database function that checks the rules
 * (see supabase/migrations/20261107000100_sessions_lobbies.sql).
 */
import { participantPrice, type ExperienceLevel } from '@kartup/domain';
import { ApiError } from '../api';
import type {
  AppNotification,
  ChatMessage,
  CreateSessionInput,
  DisputedResults,
  KartSession,
  LeaderboardEntry,
  LeaderboardScope,
  LobbyMember,
  NotificationPrefs,
  PartnerDeskSession,
  PartnerReportRow,
  PartnerStats,
  ProgressEntry,
  SessionFilters,
  SessionResults,
  Track,
  UserSummary,
} from '../types';
import { publicStorageUrl, supabase } from './client';

type Row = Record<string, any>;

const SKILL_ORDER: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];
const TRACKS_TTL_MS = 5 * 60_000;

function fail(error: { code?: string; message?: string } | null, params: Record<string, string | number> = {}) {
  // Database functions raise the error code as the message (e.g. "session_full").
  if (error) throw new ApiError(error.code && error.code.length > 5 ? error.code : (error.message ?? 'generic'), params);
}

function toTrack(r: Row): Track {
  return {
    id: r.id,
    cityId: r.city_id,
    name: r.name,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    website: r.website,
    phone: r.phone,
    openingHours: r.opening_hours ?? '',
    kartTypes: r.kart_types ?? [],
    sessionLengthMin: r.session_length_min,
    maxDrivers: r.max_drivers,
    timezone: r.timezone,
    checkinRadiusM: r.checkin_radius_m,
    indoor: r.indoor,
    lapLengthM: r.lap_length_m,
    lapLengthVerified: r.lap_length_verified,
    price: {
      perDriverMinor: r.price_per_driver_minor,
      currency: r.currency,
      updatedAt: r.price_updated_at,
      source: 'manual',
      sourceUrl: r.price_source_url,
      verified: r.price_verified,
      note: r.price_note,
    },
  };
}

// Tracks rarely change: one fetch serves every session card for a few minutes.
let tracksCache: { at: number; list: Promise<Track[]> } | null = null;
export function allTracks(): Promise<Track[]> {
  if (!tracksCache || Date.now() - tracksCache.at > TRACKS_TTL_MS) {
    const list = (async () => {
      const { data, error } = await supabase.from('track_details').select('*').order('name');
      fail(error);
      return (data ?? []).map(toTrack);
    })();
    list.catch(() => (tracksCache = null));
    tracksCache = { at: Date.now(), list };
  }
  return tracksCache.list;
}

const avatar = (path: string | null, provider: string | null) => publicStorageUrl('avatars', path) ?? provider ?? null;

function hostOf(r: Row): UserSummary {
  if (!r.host_id) return { id: 'deleted', firstName: 'Deleted', lastName: 'user', avatarUrl: null, rankTierId: 1, totalXp: 0, totalKm: 0 };
  return {
    id: r.host_id,
    firstName: r.host_first_name ?? '',
    lastName: r.host_last_name ?? '',
    avatarUrl: avatar(r.host_avatar_path, r.host_provider_avatar_url),
    rankTierId: r.host_rank_tier_id,
    totalXp: r.host_total_xp,
    totalKm: r.host_total_meters / 1000,
  };
}

function toSession(r: Row, tracks: Track[]): KartSession | null {
  const track = tracks.find((t) => t.id === r.track_id);
  if (!track) return null; // track no longer offered
  return {
    id: r.id,
    track,
    host: hostOf(r),
    startsAt: r.starts_at,
    maxDrivers: r.max_drivers,
    minRankTierId: r.min_rank_tier_id,
    minSkill: r.min_skill,
    note: r.note,
    isOfficialEvent: r.is_official_event,
    lobbyType: r.lobby_type,
    cancelledAt: r.cancelled_at,
    cancelledBy: r.cancelled_by,
    price: participantPrice(r.track_price_minor, r.fee_minor, r.currency),
    priceUpdatedAt: r.price_updated_at,
    paidCount: r.paid_count,
    memberCount: r.member_count,
    resultsStatus: r.results_status ?? null,
    myStatus: r.my_status ?? null,
    myBookingCode: r.my_booking_code ?? null,
    createdAt: r.created_at,
  };
}

async function cards(query: PromiseLike<{ data: Row[] | null; error: { code?: string; message?: string } | null }>): Promise<KartSession[]> {
  const [{ data, error }, tracks] = await Promise.all([query, allTracks()]);
  fail(error);
  return (data ?? []).map((r) => toSession(r, tracks)).filter((s): s is KartSession => s !== null);
}

const localDate = (iso: string, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(iso));

export const sessionsApi = {
  async list(f: SessionFilters): Promise<KartSession[]> {
    let q = supabase.from('session_cards').select('*').eq('city_id', f.cityId).is('cancelled_at', null).gt('starts_at', new Date().toISOString());
    if (f.trackId) q = q.eq('track_id', f.trackId);
    const list = await cards(q.order('starts_at'));
    return list.filter((s) => {
      if (f.date && localDate(s.startsAt, s.track.timezone) !== f.date) return false;
      if (f.skill && s.minSkill && SKILL_ORDER.indexOf(s.minSkill) > SKILL_ORDER.indexOf(f.skill)) return false;
      return s.maxDrivers - s.paidCount >= f.minSpotsLeft;
    });
  },

  async mine(): Promise<KartSession[]> {
    const { data } = await supabase.auth.getUser();
    const me = data.user?.id;
    if (!me) throw new ApiError('unauthorized');
    return cards(
      supabase
        .from('session_cards')
        .select('*')
        .or(`host_id.eq.${me},my_status.in.(joined_unpaid,confirmed,attended,no_show,cancelled)`)
        .order('starts_at'),
    );
  },

  async get(id: string): Promise<KartSession | null> {
    const list = await cards(supabase.from('session_cards').select('*').eq('id', id));
    return list[0] ?? null;
  },

  async create(input: CreateSessionInput): Promise<KartSession> {
    const { data, error } = await supabase.rpc('create_session', {
      p_track: input.trackId,
      p_starts_at: input.startsAt,
      p_max_drivers: input.maxDrivers,
      p_min_rank: input.minRankTierId,
      p_min_skill: input.minSkill,
      p_note: input.note,
      p_lobby_type: input.lobbyType,
    });
    if (error) {
      const track = (await allTracks()).find((t) => t.id === input.trackId);
      fail(error, { hours: 4, min: 4, max: track?.maxDrivers ?? 10 });
    }
    const s = await sessionsApi.get(data as string);
    if (!s) throw new ApiError('not_found');
    return s;
  },

  async members(sessionId: string): Promise<LobbyMember[]> {
    const { data, error } = await supabase.from('lobby_members').select('*').eq('session_id', sessionId).order('joined_at');
    fail(error);
    return (data ?? []).map((m: Row) => ({
      id: m.user_id,
      firstName: m.first_name ?? '',
      lastName: m.last_name ?? '',
      avatarUrl: avatar(m.avatar_path, m.provider_avatar_url),
      rankTierId: m.rank_tier_id,
      totalXp: m.total_xp,
      totalKm: m.total_meters / 1000,
      status: m.status,
      bookingCode: m.booking_code ?? null,
      isHost: m.is_host,
      joinedAt: m.joined_at,
      paidAt: m.paid_at,
      checkedInAt: m.checked_in_at,
      hostConfirmed: m.host_confirmed,
    }));
  },

  async reserveSeat(sessionId: string): Promise<void> {
    const { error } = await supabase.rpc('reserve_seat', { p_session: sessionId });
    fail(error);
  },

  async leaveLobby(sessionId: string): Promise<void> {
    const { error } = await supabase.rpc('leave_session', { p_session: sessionId });
    fail(error);
  },

  /** "Pay at the track": giving up a seat has nothing to refund. */
  async cancelSeat(sessionId: string): Promise<{ refunded: boolean }> {
    await sessionsApi.leaveLobby(sessionId);
    return { refunded: false };
  },

  async removeMember(sessionId: string, userId: string): Promise<{ refunded: boolean }> {
    const { error } = await supabase.rpc('remove_member', { p_session: sessionId, p_user: userId });
    fail(error);
    return { refunded: false };
  },

  async cancelSession(sessionId: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc('cancel_session', { p_session: sessionId, p_reason: reason });
    fail(error);
  },

  /** Lobby chat: members only (the database checks it), without people you blocked. */
  async messages(sessionId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase.from('chat_messages').select('*').eq('session_id', sessionId).order('created_at');
    fail(error);
    return (data ?? []).map((m: Row) => ({
      id: m.id,
      sessionId: m.session_id,
      author: m.user_id
        ? {
            id: m.user_id,
            firstName: m.first_name ?? '',
            lastName: m.last_name ?? '',
            avatarUrl: avatar(m.avatar_path, m.provider_avatar_url),
            rankTierId: m.rank_tier_id ?? 1,
            totalXp: m.total_xp ?? 0,
            totalKm: (m.total_meters ?? 0) / 1000,
          }
        : { id: 'deleted', firstName: 'Deleted', lastName: 'user', avatarUrl: null, rankTierId: 1, totalXp: 0, totalKm: 0 },
      body: m.body,
      createdAt: m.created_at,
      system: m.system,
    }));
  },

  async sendMessage(sessionId: string, body: string): Promise<void> {
    const { error } = await supabase.rpc('send_message', { p_session: sessionId, p_body: body });
    fail(error);
  },
};

/** Reporting and blocking (Apple guideline 1.2). Reports are read by KartUP admins. */
export const moderationApi = {
  async report(target: { kind: 'profile'; userId: string } | { kind: 'message'; messageId: string }, reason: string): Promise<void> {
    const { error } = await supabase.rpc('report_content', {
      p_kind: target.kind,
      p_user: target.kind === 'profile' ? target.userId : null,
      p_message: target.kind === 'message' ? target.messageId : null,
      p_reason: reason,
    });
    fail(error);
  },
  async block(userId: string): Promise<void> {
    const { data } = await supabase.auth.getUser();
    const { error } = await supabase.from('user_blocks').upsert({ blocker_id: data.user?.id, blocked_id: userId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
    fail(error);
  },
  async unblock(userId: string): Promise<void> {
    const { error } = await supabase.from('user_blocks').delete().eq('blocked_id', userId);
    fail(error);
  },
  async blocked(): Promise<string[]> {
    const { data, error } = await supabase.from('user_blocks').select('blocked_id');
    fail(error);
    return (data ?? []).map((b: Row) => b.blocked_id);
  },
};

// ── Live updates: any change to sessions or lobby members refreshes what's on screen ──
let channel: ReturnType<typeof supabase.channel> | null = null;

// ── Notifications ─────────────────────────────────────────────────────────────
const newListeners = new Set<(n: AppNotification) => void>();

function toNotification(r: Row): AppNotification {
  return { id: r.id, type: r.type, createdAt: r.created_at, readAt: r.read_at, data: r.data ?? {} };
}

const DEFAULT_PREFS: NotificationPrefs = { lobby: true, chat: true, reminders: true, results: true, ranking: true, account: true };

export const notificationsApi = {
  async list(): Promise<AppNotification[]> {
    const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
    fail(error);
    return (data ?? []).map(toNotification);
  },
  async markAllRead(): Promise<void> {
    fail((await supabase.rpc('mark_notifications_read', {})).error);
  },
  async markRead(id: string): Promise<void> {
    fail((await supabase.rpc('mark_notifications_read', { p_id: id })).error);
  },
  async prefs(): Promise<NotificationPrefs> {
    const { data, error } = await supabase.from('notification_prefs').select('lobby, chat, reminders, results, ranking').maybeSingle();
    fail(error);
    return { ...DEFAULT_PREFS, ...(data ?? {}), account: true };
  },
  async setPrefs(p: NotificationPrefs): Promise<void> {
    fail((await supabase.rpc('set_notification_prefs', { p_lobby: p.lobby, p_chat: p.chat, p_reminders: p.reminders, p_results: p.results, p_ranking: p.ranking })).error);
  },
  /** Fires for each new notification while the app is open (banners, rank-up celebration). */
  onNew(cb: (n: AppNotification) => void): () => void {
    newListeners.add(cb);
    const stop = subscribeLive('notifications', () => undefined);
    return () => {
      newListeners.delete(cb);
      stop();
    };
  },
};

/**
 * Live updates, built to stay light with hundreds of people online at once:
 *  - each change only refreshes the screens it concerns (its topic), not everything;
 *  - refreshes are grouped (several changes in a moment = one refresh), and the shared
 *    session list waits a small random delay so 500 phones don't hit the database together;
 *  - chat messages are only received for the sessions you have open (filtered on the server);
 *  - notifications are only received for yourself (filtered on the server).
 * One connection per phone; channels are opened only while a screen needs them.
 */
const topicListeners = new Map<string, Set<() => void>>();
const pendingTopics = new Map<string, ReturnType<typeof setTimeout>>();
let liveUserId: string | null = null;
const sessionChannels = new Map<string, ReturnType<typeof supabase.channel>>();
let authWatch: { unsubscribe: () => void } | null = null;

function emit(topic: string, spreadMs = 0) {
  if (!topicListeners.get(topic)?.size || pendingTopics.has(topic)) return;
  const delay = 250 + Math.round(Math.random() * spreadMs);
  pendingTopics.set(
    topic,
    setTimeout(() => {
      pendingTopics.delete(topic);
      topicListeners.get(topic)?.forEach((l) => l());
    }, delay),
  );
}

function openBaseChannel(userId: string) {
  const onSession = (sessionId?: string) => {
    emit('sessions', 1500);
    if (sessionId) emit(`session:${sessionId}`);
  };
  channel = supabase
    .channel(`kartup-live-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, (p) => onSession(((p.new as Row)?.id ?? (p.old as Row)?.id) as string))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'session_members' }, (p) => {
      const row = ((p.new as Row) ?? (p.old as Row)) || {};
      onSession(row.session_id);
      if (row.user_id === userId) emit('me');
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
      const n = toNotification(payload.new as Row);
      emit('notifications');
      // Results posted / disputed / final for a session: refresh that session's screens too.
      if (typeof n.data.sessionId === 'string') emit(`session:${n.data.sessionId}`);
      if (n.type === 'results_confirmed' || n.type === 'rank_up') {
        emit('leaderboard', 1500);
        emit(`profile:${userId}`);
        emit('me');
      }
      newListeners.forEach((l) => l(n));
    })
    .subscribe();
}

function closeBaseChannel() {
  if (channel) void supabase.removeChannel(channel);
  channel = null;
}

async function ensureBaseChannel() {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id ?? null;
  if (userId === liveUserId && (channel || !userId)) return;
  closeBaseChannel();
  liveUserId = userId;
  if (userId && topicListeners.size) openBaseChannel(userId);
}

/** Chat messages of one session, only while that session is on screen. */
function syncSessionChannel(topic: string) {
  if (!topic.startsWith('session:')) return;
  const id = topic.slice('session:'.length);
  const wanted = !!topicListeners.get(topic)?.size;
  const open = sessionChannels.get(id);
  if (wanted && !open) {
    sessionChannels.set(
      id,
      supabase
        .channel(`kartup-chat-${id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `session_id=eq.${id}` }, () => emit(topic))
        .subscribe(),
    );
  } else if (!wanted && open) {
    void supabase.removeChannel(open);
    sessionChannels.delete(id);
  }
}

export function subscribeLive(topic: string, cb: () => void): () => void {
  if (!topicListeners.has(topic)) topicListeners.set(topic, new Set());
  topicListeners.get(topic)!.add(cb);
  syncSessionChannel(topic);
  void ensureBaseChannel();
  // Signing in or out (or switching accounts) re-opens the channel for the right person.
  authWatch ??= supabase.auth.onAuthStateChange(() => void ensureBaseChannel()).data.subscription;
  return () => {
    const set = topicListeners.get(topic);
    set?.delete(cb);
    if (set && set.size === 0) topicListeners.delete(topic);
    syncSessionChannel(topic);
    if (topicListeners.size === 0) {
      closeBaseChannel();
      liveUserId = null;
      authWatch?.unsubscribe();
      authWatch = null;
    }
  };
}

// ── Results (step 3) ──────────────────────────────────────────────────────────
const SHEETS = 'timing-sheets';

export const resultsApi = {
  /** Finalizes them first on the server if their 24 h passed. */
  async get(sessionId: string): Promise<SessionResults | null> {
    const { data, error } = await supabase.rpc('get_session_results', { p_session: sessionId });
    fail(error);
    if (!data) return null;
    const r = data as Row;
    let printoutUrl: string | null = null;
    if (r.printoutPath) {
      // Private bucket: a link that works for an hour.
      const signed = await supabase.storage.from(SHEETS).createSignedUrl(r.printoutPath, 3600);
      printoutUrl = signed.data?.signedUrl ?? null;
    }
    return {
      sessionId: r.sessionId,
      submittedBy: r.submittedBy,
      submittedAt: r.submittedAt,
      deadline: r.deadline,
      status: r.status,
      source: r.source,
      lobbyType: r.lobbyType,
      printoutUrl,
      entries: (r.entries as Row[]).map((e) => ({ userId: e.userId, position: e.position, laps: e.laps, bestLapMs: e.bestLapMs, xp: e.xp, km: e.km, breakdown: e.breakdown })),
      responses: (r.responses as Row[]).map((x) => ({ userId: x.userId, response: x.response, comment: x.comment })),
    };
  },

  async submit(sessionId: string, input: { entries: { userId: string; position: number; laps: number; bestLapMs: number | null }[]; printoutUri: string | null }): Promise<void> {
    let path: string | null = null;
    if (input.printoutUri) {
      path = `${sessionId}/sheet-${Date.now()}.jpg`;
      const body = await (await fetch(input.printoutUri)).arrayBuffer();
      const up = await supabase.storage.from(SHEETS).upload(path, body, { contentType: 'image/jpeg', upsert: false });
      fail(up.error);
    }
    const { error } = await supabase.rpc('submit_results', {
      p_session: sessionId,
      p_entries: input.entries.map((e) => ({ user_id: e.userId, position: e.position, laps: e.laps, best_lap_ms: e.bestLapMs })),
      p_printout_path: path,
    });
    fail(error);
  },

  async respond(sessionId: string, response: 'confirm' | 'dispute', comment?: string): Promise<void> {
    const { error } = await supabase.rpc('respond_results', { p_session: sessionId, p_response: response, p_comment: comment ?? null });
    fail(error);
  },
};

// ── Leaderboards and race history (step 4) ────────────────────────────────────
export const rankingApi = {
  async leaderboard(scope: LeaderboardScope): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase.rpc('leaderboard', {
      p_kind: scope.kind,
      p_city: scope.kind === 'city' ? scope.cityId : null,
      p_track: scope.kind === 'track' ? scope.trackId : null,
      p_season: scope.kind === 'season' ? scope.season : null,
    });
    fail(error);
    return ((data as Row[]) ?? []).map((r, i) => ({
      position: i + 1,
      user: {
        id: r.user_id,
        firstName: r.first_name ?? '',
        lastName: r.last_name ?? '',
        avatarUrl: avatar(r.avatar_path, r.provider_avatar_url),
        rankTierId: r.rank_tier_id ?? 1,
        totalXp: r.total_xp ?? 0,
        totalKm: (r.total_meters ?? 0) / 1000,
      },
      xp: r.xp,
      km: r.meters / 1000,
      sessions: r.sessions,
      wins: r.wins,
    }));
  },

  async seasons(): Promise<string[]> {
    const { data, error } = await supabase.rpc('race_seasons');
    fail(error);
    return ((data as unknown[]) ?? []).map((s) => (typeof s === 'string' ? s : (s as Row).race_seasons));
  },
};

/** Verified races of a driver, newest first (self-reports arrive later). */
export async function progressHistory(userId: string): Promise<ProgressEntry[]> {
  const { data, error } = await supabase.from('race_ledger').select('*, tracks(name)').eq('user_id', userId).order('raced_at', { ascending: false });
  fail(error);
  return (data ?? []).map((l: Row) => ({
    id: String(l.id),
    kind: l.kind,
    casual: l.casual,
    penaltyReason: null,
    penaltyNominal: null,
    sessionId: l.session_id,
    trackId: l.track_id,
    trackName: l.tracks?.name ?? '',
    date: l.raced_at,
    position: l.position,
    fieldSize: l.field_size,
    laps: l.laps,
    bestLapMs: l.best_lap_ms,
    verification: 'verified',
    source: l.source,
    xp: l.casual ? null : l.xp,
    km: l.casual ? null : l.meters / 1000,
    breakdown: l.breakdown,
    review: null,
  }));
}

// ── Admin tools ───────────────────────────────────────────────────────────────
export const adminSessionsApi = {
  /** Upcoming sessions (official toggle) and recent ones that may need results. */
  async sessions(): Promise<KartSession[]> {
    const since = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const list = await cards(supabase.from('session_cards').select('*').is('cancelled_at', null).gt('starts_at', since).order('starts_at'));
    return list.filter((s) => new Date(s.startsAt).getTime() > Date.now() || !s.resultsStatus);
  },
  async setOfficialEvent(sessionId: string, official: boolean): Promise<void> {
    const { error } = await supabase.rpc('set_official_event', { p_session: sessionId, p_official: official });
    fail(error);
  },
  async disputedResults(): Promise<DisputedResults[]> {
    const { data, error } = await supabase.rpc('admin_disputed_results');
    fail(error);
    return (data as DisputedResults[]) ?? [];
  },
  async decideResults(sessionId: string, approve: boolean): Promise<void> {
    const { error } = await supabase.rpc('admin_decide_results', { p_session: sessionId, p_approve: approve });
    fail(error);
  },
  /** Self-reported results come later in the real app. */
  async pendingSelfReports() {
    return [];
  },
};

// ── Track partner panel ───────────────────────────────────────────────────────
export const partnerApi = {
  async myTracks(): Promise<string[]> {
    const { data, error } = await supabase.rpc('my_partner_tracks');
    fail(error);
    return ((data as unknown[]) ?? []).map((x) => (typeof x === 'string' ? x : (x as Row).my_partner_tracks));
  },
  async desk(trackId: string, fromIso: string, toIso: string): Promise<PartnerDeskSession[]> {
    const { data, error } = await supabase.rpc('track_desk', { p_track: trackId, p_from: fromIso, p_to: toIso });
    fail(error);
    return (data as PartnerDeskSession[]) ?? [];
  },
  async markArrived(sessionId: string, userId: string, arrived: boolean): Promise<void> {
    const { error } = await supabase.rpc('mark_arrived', { p_session: sessionId, p_user: userId, p_arrived: arrived });
    fail(error);
  },
  async stats(trackId: string, month: string): Promise<PartnerStats> {
    const { data, error } = await supabase.rpc('track_partner_stats', { p_track: trackId, p_month: month });
    fail(error);
    return data as PartnerStats;
  },
  async report(trackId: string, month: string): Promise<PartnerReportRow[]> {
    const { data, error } = await supabase.rpc('partner_report', { p_track: trackId, p_month: month });
    fail(error);
    return (data as PartnerReportRow[]) ?? [];
  },
};
