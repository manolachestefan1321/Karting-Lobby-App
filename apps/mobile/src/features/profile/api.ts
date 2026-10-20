import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_MIN_AGE, type ProfileInput, type TrackExperienceInput } from '@kartapp/domain';
import { readAsArrayBuffer } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import type { City, PublicProfile, RankTier, TrackExperience, TrackSummary } from '@/lib/types';
import { profileQueryKey } from '@/features/auth/AuthProvider';

const STALE_REFERENCE = 1000 * 60 * 30; // reference data rarely changes

export function useMinAge() {
  return useQuery({
    queryKey: ['config', 'min_age'],
    staleTime: STALE_REFERENCE,
    queryFn: async () => {
      const { data } = await supabase.from('app_config').select('value').eq('key', 'min_age').maybeSingle();
      return typeof data?.value === 'number' ? data.value : DEFAULT_MIN_AGE;
    },
  });
}

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    staleTime: STALE_REFERENCE,
    queryFn: async () => {
      const { data, error } = await supabase.from('cities').select('id, name, slug, country_code, timezone').order('name');
      if (error) throw error;
      return data as City[];
    },
  });
}

export function useTracks() {
  return useQuery({
    queryKey: ['tracks', 'summary'],
    staleTime: STALE_REFERENCE,
    queryFn: async () => {
      const { data, error } = await supabase.from('tracks').select('id, name, city_id').order('name');
      if (error) throw error;
      return data as TrackSummary[];
    },
  });
}

export function useRankTiers() {
  return useQuery({
    queryKey: ['rank_tiers'],
    staleTime: STALE_REFERENCE,
    queryFn: async () => {
      const { data, error } = await supabase.from('rank_tiers').select('*').order('min_points');
      if (error) throw error;
      return data as RankTier[];
    },
  });
}

export function usePublicProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['public_profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('public_profiles').select('*').eq('id', userId!).maybeSingle();
      if (error) throw error;
      return data as PublicProfile | null;
    },
  });
}

export function useTrackExperience(userId: string | undefined) {
  return useQuery({
    queryKey: ['track_experience', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('track_experience')
        .select('*, tracks(name)')
        .eq('user_id', userId!)
        .order('sessions_count', { ascending: false });
      if (error) throw error;
      return data as TrackExperience[];
    },
  });
}

export function useSaveProfile(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileInput & { acceptTerms?: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: input.firstName,
          last_name: input.lastName,
          date_of_birth: input.dateOfBirth,
          home_city_id: input.homeCityId,
          bio: input.bio,
          ...(input.acceptTerms ? { terms_accepted_at: new Date().toISOString() } : {}),
        })
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: profileQueryKey(userId) });
      await qc.invalidateQueries({ queryKey: ['public_profile', userId] });
    },
  });
}

/** Uploads a new avatar (already cropped/compressed) and deletes the previous file. */
export function useUploadAvatar(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ uri, previousPath }: { uri: string; previousPath: string | null }) => {
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const body = await readAsArrayBuffer(uri);
      const { error } = await supabase.storage.from('avatars').upload(path, body, {
        contentType: 'image/jpeg',
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) throw error;
      const { error: updateError } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId);
      if (updateError) throw updateError;
      if (previousPath) await supabase.storage.from('avatars').remove([previousPath]);
      return path;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: profileQueryKey(userId) });
      await qc.invalidateQueries({ queryKey: ['public_profile', userId] });
    },
  });
}

export function useRemoveAvatar(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (path: string) => {
      const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('id', userId);
      if (error) throw error;
      await supabase.storage.from('avatars').remove([path]);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: profileQueryKey(userId) });
      await qc.invalidateQueries({ queryKey: ['public_profile', userId] });
    },
  });
}

export function useUpsertExperience(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TrackExperienceInput) => {
      const { error } = await supabase.from('track_experience').upsert({
        user_id: userId,
        track_id: input.trackId,
        level: input.level,
        best_lap_ms: input.bestLapMs,
        sessions_count: input.sessionsCount,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['track_experience', userId] }),
  });
}

export function useDeleteExperience(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trackId: string) => {
      const { error } = await supabase.from('track_experience').delete().eq('user_id', userId).eq('track_id', trackId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['track_experience', userId] }),
  });
}

export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
}
