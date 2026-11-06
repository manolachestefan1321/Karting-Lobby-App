/**
 * Real backend (Supabase). Auth, profiles, places, sessions and lobbies are wired;
 * chat, payments, results, ranking and notifications are filled in step by step —
 * until then they throw `not_implemented`.
 */
import { DEFAULT_MIN_AGE, DEFAULT_RULES } from '@kartup/domain';
import { ApiError, type DataApi } from '../api';
import { RANK_TIERS } from '../ranks';
import { ANALYTICS_RANGES, type AnalyticsReport, type City, type Profile, type PublicProfile, type Track } from '../types';
import { publicStorageUrl, supabase } from './client';
import { authRedirectUrl } from './redirect';
import { allTracks, sessionsApi, subscribeLive } from './sessions';
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

/** Uploaded photo first; otherwise the photo from Apple / Google / Facebook, if any. */
function avatarOf(r: Row): string | null {
  return publicStorageUrl('avatars', r.avatar_path) ?? r.provider_avatar_url ?? null;
}

function toProfile(r: Row): Profile {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    dateOfBirth: r.date_of_birth,
    homeCityId: r.home_city_id,
    bio: r.bio ?? '',
    avatarUrl: avatarOf(r),
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
    avatarUrl: avatarOf(r),
    // Highest rank reached (stored, never goes down) — new drivers start at 1 = Rookie.
    rankTierId: r.rank_tier_id ?? 1,
    totalXp: r.total_xp ?? 0,
    totalKm: (r.total_meters ?? 0) / 1000,
    bio: r.bio,
    homeCityId: r.home_city_id,
    age: r.age,
    sessionsRaced: r.sessions_raced,
    tracksRaced: r.tracks_visited ?? r.tracks_raced ?? 0,
    wins: r.wins,
    noShowCount: r.no_show_count ?? 0,
    createdAt: r.created_at,
    activeBan: null,
    badges: r.badges ?? [],
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
      await signOutEverywhere(); // also forgets the Google account on the device
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
      const value = (key: string) => data?.find((r: Row) => r.key === key)?.value;
      const num = (key: string, fallback: number) => (typeof value(key) === 'number' ? (value(key) as number) : fallback);
      return {
        ...DEFAULT_RULES,
        minAge: num('min_age', DEFAULT_MIN_AGE),
        platformFeeMinor: num('platform_fee_minor', DEFAULT_RULES.platformFeeMinor),
        minDrivers: num('min_drivers', DEFAULT_RULES.minDrivers),
        demoInstantResults: false,
        paymentsEnabled: value('payments_enabled') === true,
        checkinEnabled: false,
      };
    },
    cities: async () => {
      const { data, error } = await supabase.from('cities').select('id, name, slug, country_code, timezone').order('name');
      wrap(error);
      return (data ?? []).map((c: Row): City => ({ id: c.id, name: c.name, slug: c.slug, countryCode: c.country_code, timezone: c.timezone, lat: 0, lng: 0 }));
    },
    tracks: async (cityId?: string): Promise<Track[]> => (await allTracks()).filter((t) => !cityId || t.cityId === cityId),
    track: async (trackId: string) => (await allTracks()).find((t) => t.id === trackId) ?? null,
    // Ranks come from config/progression.ts (the database keeps a copy for its own checks).
    rankTiers: async () => RANK_TIERS,
  },
  sessions: {
    ...sessionsApi,
    // Pay-to-join (Stripe) arrives with the payments step.
    enterLobby: notImplemented,
    checkIn: notImplemented,
    confirmAttendance: notImplemented,
    messages: notImplemented,
    sendMessage: notImplemented,
  },
  payments: { createIntent: notImplemented, confirm: notImplemented, history: notImplemented },
  results: { get: notImplemented, submit: notImplemented, respond: notImplemented },
  ranking: { leaderboard: notImplemented, seasons: notImplemented },
  admin: { pendingSelfReports: notImplemented, reviewSelfReport: notImplemented, setOfficialEvent: notImplemented, sessions: notImplemented, finance: notImplemented, cashout: notImplemented },
  notifications: {
    list: notImplemented,
    markAllRead: notImplemented,
    markRead: notImplemented,
    prefs: notImplemented,
    setPrefs: notImplemented,
    onNew: () => () => undefined,
  },
  moderation: { report: notImplemented, block: notImplemented, unblock: notImplemented, blocked: notImplemented },
  realtime: { subscribe: (_topic, cb) => subscribeLive(cb) },
  location: { current: notImplemented },
  launch: {
    signup: async ({ firstName, lastName, phone, email, locale }) => {
      // Insert only: visitors can't read the list back (no .select()).
      const { error } = await supabase
        .from('launch_signups')
        .insert({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim(), email: email.trim().toLowerCase(), locale });
      if (error?.code === '23505') return 'exists';
      wrap(error);
      return 'created';
    },
  },
  analytics: {
    track: async (e) => {
      // Fire and forget: analytics must never break the page.
      await supabase.from('site_events').insert({
        visitor_id: e.visitorId,
        session_id: e.sessionId,
        kind: e.kind,
        path: e.path.slice(0, 200),
        referrer: e.referrer?.slice(0, 200) ?? null,
        utm_source: e.utmSource?.slice(0, 80) ?? null,
        device: e.device,
      });
    },
    consent: async ({ consentId, analytics, version, locale }) => {
      await supabase.from('consent_log').insert({ consent_id: consentId, analytics, version, locale });
    },
    report: async (range) => {
      const { seconds, buckets } = ANALYTICS_RANGES[range];
      const { data, error } = await supabase.rpc('analytics_report', { p_seconds: seconds, p_buckets: buckets });
      if (error?.message?.includes('founder_only')) throw new ApiError('admin_only');
      wrap(error);
      const r = data as Omit<AnalyticsReport, 'range' | 'from' | 'revenue' | 'karting'>;
      // Payments and karting sessions aren't in the real backend yet: shown as "not live".
      return { ...r, range, from: new Date(Date.now() - seconds * 1000).toISOString(), revenue: null, karting: null };
    },
  },
};
