import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileInput, TrackExperienceInput } from '@kartup/domain';
import { api, type SelfReportInput } from '@/data';
import { useLiveQuery } from '@/lib/live';

const STALE_REFERENCE = 1000 * 60 * 30; // reference data rarely changes

export function useRules() {
  return useQuery({ queryKey: ['rules'], staleTime: STALE_REFERENCE, queryFn: () => api.places.rules() });
}

export function useMinAge() {
  const rules = useRules();
  return { ...rules, data: rules.data?.minAge };
}

export function useCities() {
  return useQuery({ queryKey: ['cities'], staleTime: STALE_REFERENCE, queryFn: () => api.places.cities() });
}

export function useTracks(cityId?: string) {
  return useQuery({ queryKey: ['tracks', cityId ?? 'all'], staleTime: STALE_REFERENCE, queryFn: () => api.places.tracks(cityId) });
}

export function useTrack(trackId: string | undefined) {
  return useQuery({ queryKey: ['track', trackId], enabled: !!trackId, queryFn: () => api.places.track(trackId!) });
}

export function useRankTiers() {
  return useQuery({ queryKey: ['rank_tiers'], staleTime: STALE_REFERENCE, queryFn: () => api.places.rankTiers() });
}

export function usePublicProfile(userId: string | undefined) {
  return useLiveQuery(`profile:${userId}`, { queryKey: ['public_profile', userId], enabled: !!userId, queryFn: () => api.profiles.getPublic(userId!) });
}

export function useTrackExperience(userId: string | undefined) {
  return useLiveQuery(`profile:${userId}`, { queryKey: ['track_experience', userId], enabled: !!userId, queryFn: () => api.profiles.listExperience(userId!) });
}

export function useProgressHistory(userId: string | undefined) {
  return useLiveQuery(`profile:${userId}`, { queryKey: ['progress_history', userId], enabled: !!userId, queryFn: () => api.profiles.progressHistory(userId!) });
}

/** Mutations invalidate everything: simple and always correct for a small app. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useSaveProfile() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: ProfileInput & { acceptTerms?: boolean }) => api.profiles.update(input),
    onSuccess: invalidate,
  });
}

export function useUploadAvatar() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (uri: string) => api.profiles.uploadAvatar(uri), onSuccess: invalidate });
}

export function useRemoveAvatar() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: () => api.profiles.removeAvatar(), onSuccess: invalidate });
}

export function useUpsertExperience() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: TrackExperienceInput) => api.profiles.upsertExperience(input), onSuccess: invalidate });
}

export function useDeleteExperience() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (trackId: string) => api.profiles.deleteExperience(trackId), onSuccess: invalidate });
}

export function useSetupPayouts() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: () => api.profiles.setupPayouts(), onSuccess: invalidate });
}

export function useAppealBan() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: ({ banId, message }: { banId: string; message: string }) => api.profiles.appealBan(banId, message), onSuccess: invalidate });
}

export function useSelfReport() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: SelfReportInput) => api.profiles.selfReport(input), onSuccess: invalidate });
}
