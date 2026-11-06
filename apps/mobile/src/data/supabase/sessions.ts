/**
 * Real backend: tracks, sessions and lobbies (step 1 of the core loop).
 * Reads come from the views `track_details`, `session_cards` and `lobby_members`;
 * every change goes through a database function that checks the rules
 * (see supabase/migrations/20261107000100_sessions_lobbies.sql).
 */
import { participantPrice, type ExperienceLevel } from '@kartup/domain';
import { ApiError } from '../api';
import type { CreateSessionInput, KartSession, LobbyMember, SessionFilters, Track, UserSummary } from '../types';
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
    resultsStatus: null, // results arrive in step 3
    myStatus: r.my_status ?? null,
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
};

// ── Live updates: any change to sessions or lobby members refreshes what's on screen ──
const listeners = new Set<() => void>();
let channel: ReturnType<typeof supabase.channel> | null = null;

export function subscribeLive(cb: () => void): () => void {
  listeners.add(cb);
  if (!channel) {
    const fire = () => listeners.forEach((l) => l());
    channel = supabase
      .channel('kartup-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_members' }, fire)
      .subscribe();
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }
  };
}
