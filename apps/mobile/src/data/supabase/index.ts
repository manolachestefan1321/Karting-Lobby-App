/**
 * Real backend (Supabase). Auth, profiles and places are wired to the step-1 schema.
 * Sessions, payments, results, ranking and notifications are filled in when we move
 * from the web preview to the real backend — until then they throw `not_implemented`.
 */
import { DEFAULT_MIN_AGE, DEFAULT_RULES } from '@kartup/domain';
import { ApiError, type DataApi } from '../api';
import { RANK_TIERS } from '../ranks';
import type { City, Profile, PublicProfile, Track } from '../types';
import { publicStorageUrl, supabase } from './client';
import { authRedirectUrl } from './redirect';
import { signInWithApple, signInWithGoogle, signInWithOAuthBrowser, signOutEverywhere } from './social';

const notImplemented = (): never => {
  throw new ApiError('not_implemented');
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new ApiError('unauthorized');
  return data.user.id;
}

function wrap(error: { code?: string; message?: string } | null) {
  if (error) throw new ApiError(error.code && error.code.length > 5 ? error.code : (error.message ?? 'generic'));
}

type Row = Record<string, any>;

function toProfile(r: Row): Profile {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    dateOfBirth: r.date_of_birth,
    homeCityId: r.home_city_id,
    bio: r.bio ?? '',
    avatarUrl: publicStorageUrl('avatars', r.avatar_path),
    locale: r.locale,
    role: r.role,
    termsAcceptedAt: r.terms_accepted_at,
    onboardedAt: r.onboarded_at,
    payoutsEnabled: !!r.payouts_enabled,
    createdAt: r.created_at,
  };
}

function toPublic(r: Row): PublicProfile {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    avatarUrl: publicStorageUrl('avatars', r.avatar_path),
    rankTierId: r.rank_tier_id,
    // Columns added by the progression migration in the real-version phase.
    totalXp: r.total_xp ?? 0,
    totalKm: (r.total_meters ?? 0) / 1000,
    bio: r.bio,
    homeCityId: r.home_city_id,
    age: r.age,
    sessionsRaced: r.sessions_raced,
    tracksRaced: r.tracks_raced,
    wins: r.wins,
    noShowCount: r.no_show_count ?? 0,
    createdAt: r.created_at,
    activeBan: null,
  };
}

let lastAvatarPath: string | null = null;

export const supabaseApi: DataApi = {
  kind: 'supabase',
  clock: { now: () => new Date(), subscribe: () => () => undefined },
  auth: {
    getUser: async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? '', provider: (u.app_metadata.provider as 'email') ?? 'email' } : null;
    },
    onChange: (cb) => {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        const u = session?.user;
        const user = u ? { id: u.id, email: u.email ?? '', provider: (u.app_metadata.provider as 'email') ?? 'email' } : null;
        cb(user, event === 'PASSWORD_RECOVERY' ? 'password_recovery' : user ? 'signed_in' : 'signed_out');
      });
      return () => data.subscription.unsubscribe();
    },
    signInWithPassword: async (email, password) => wrap((await supabase.auth.signInWithPassword({ email, password })).error),
    signUp: async ({ email, password, locale }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: authRedirectUrl(), data: { terms_accepted: true, locale } },
      });
      wrap(error);
      return { needsConfirmation: !data.session };
    },
    signInWithProvider: (p) => (p === 'apple' ? signInWithApple() : p === 'google' ? signInWithGoogle() : signInWithOAuthBrowser('facebook')),
    resendConfirmation: async (email) => wrap((await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl() } })).error),
    requestPasswordReset: async (email) => wrap((await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl('reset-password') })).error),
    handleRedirect: async ({ code, next, error_description }) => {
      if (error_description || !code) return 'failed';
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return next === 'reset-password' ? 'failed' : 'confirmed_elsewhere';
      return next === 'reset-password' ? 'password_recovery' : 'signed_in';
    },
    updatePassword: async (password) => wrap((await supabase.auth.updateUser({ password })).error),
    signOut: signOutEverywhere,
    deleteAccount: async () => {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
      if (error) throw new ApiError('generic');
      await supabase.auth.signOut();
    },
  },
  profiles: {
    getMine: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', await uid()).single();
      wrap(error);
      lastAvatarPath = data!.avatar_path;
      return toProfile(data!);
    },
    update: async (input) => {
      const patch: Row = {};
      if (input.firstName !== undefined) patch.first_name = input.firstName;
      if (input.lastName !== undefined) patch.last_name = input.lastName;
      if (input.dateOfBirth !== undefined) patch.date_of_birth = input.dateOfBirth;
      if (input.homeCityId !== undefined) patch.home_city_id = input.homeCityId;
      if (input.bio !== undefined) patch.bio = input.bio;
      if (input.locale) patch.locale = input.locale;
      if (input.acceptTerms) patch.terms_accepted_at = new Date().toISOString();
      const { error } = await supabase.from('profiles').update(patch).eq('id', await uid());
      if (error?.message?.includes('under_min_age')) throw new ApiError('under_min_age');
      wrap(error);
    },
    uploadAvatar: async (uri) => {
      const id = await uid();
      const path = `${id}/avatar-${Date.now()}.jpg`;
      const body = await (await fetch(uri)).arrayBuffer();
      wrap((await supabase.storage.from('avatars').upload(path, body, { contentType: 'image/jpeg', upsert: false })).error);
      wrap((await supabase.from('profiles').update({ avatar_path: path }).eq('id', id)).error);
      if (lastAvatarPath) await supabase.storage.from('avatars').remove([lastAvatarPath]);
      lastAvatarPath = path;
    },
    removeAvatar: async () => {
      wrap((await supabase.from('profiles').update({ avatar_path: null }).eq('id', await uid())).error);
      if (lastAvatarPath) await supabase.storage.from('avatars').remove([lastAvatarPath]);
      lastAvatarPath = null;
    },
    getPublic: async (userId) => {
      const { data, error } = await supabase.from('public_profiles').select('*').eq('id', userId).maybeSingle();
      wrap(error);
      return data ? toPublic(data) : null;
    },
    listExperience: async (userId) => {
      const { data, error } = await supabase.from('track_experience').select('*, tracks(name)').eq('user_id', userId);
      wrap(error);
      return (data ?? []).map((e: Row) => ({ trackId: e.track_id, trackName: e.tracks?.name ?? '', level: e.level, bestLapMs: e.best_lap_ms, sessionsCount: e.sessions_count }));
    },
    upsertExperience: async (i) =>
      wrap((await supabase.from('track_experience').upsert({ user_id: await uid(), track_id: i.trackId, level: i.level, best_lap_ms: i.bestLapMs, sessions_count: i.sessionsCount })).error),
    deleteExperience: async (trackId) => wrap((await supabase.from('track_experience').delete().eq('user_id', await uid()).eq('track_id', trackId)).error),
    progressHistory: notImplemented,
    selfReport: notImplemented,
    setupPayouts: notImplemented,
    appealBan: notImplemented,
  },
  places: {
    rules: async () => {
      const { data } = await supabase.from('app_config').select('key, value');
      const minAge = data?.find((r: Row) => r.key === 'min_age')?.value;
      return { ...DEFAULT_RULES, minAge: typeof minAge === 'number' ? minAge : DEFAULT_MIN_AGE, demoInstantResults: false };
    },
    cities: async () => {
      const { data, error } = await supabase.from('cities').select('id, name, slug, country_code, timezone').order('name');
      wrap(error);
      return (data ?? []).map((c: Row): City => ({ id: c.id, name: c.name, slug: c.slug, countryCode: c.country_code, timezone: c.timezone, lat: 0, lng: 0 }));
    },
    tracks: async (): Promise<Track[]> => notImplemented(),
    track: async () => notImplemented(),
    // Ranks come from config/progression.ts (the database keeps a copy for its own checks).
    rankTiers: async () => RANK_TIERS,
  },
  sessions: {
    list: notImplemented,
    mine: notImplemented,
    get: notImplemented,
    create: notImplemented,
    members: notImplemented,
    enterLobby: notImplemented,
    leaveLobby: notImplemented,
    cancelSeat: notImplemented,
    removeMember: notImplemented,
    cancelSession: notImplemented,
    checkIn: notImplemented,
    confirmAttendance: notImplemented,
    messages: notImplemented,
    sendMessage: notImplemented,
  },
  payments: { createIntent: notImplemented, confirm: notImplemented, history: notImplemented },
  results: { get: notImplemented, submit: notImplemented, respond: notImplemented },
  ranking: { leaderboard: notImplemented, seasons: notImplemented },
  admin: { pendingSelfReports: notImplemented, reviewSelfReport: notImplemented, setOfficialEvent: notImplemented, sessions: notImplemented },
  notifications: {
    list: notImplemented,
    markAllRead: notImplemented,
    markRead: notImplemented,
    prefs: notImplemented,
    setPrefs: notImplemented,
    onNew: () => () => undefined,
  },
  moderation: { report: notImplemented, block: notImplemented, unblock: notImplemented, blocked: notImplemented },
  realtime: { subscribe: () => () => undefined },
  location: { current: notImplemented },
};
