import { api, type LeaderboardScope } from '@/data';
import { useLiveQuery } from '@/lib/live';

export function useLeaderboard(scope: LeaderboardScope) {
  return useLiveQuery('leaderboard', { queryKey: ['leaderboard', scope], queryFn: () => api.ranking.leaderboard(scope) });
}

export function useSeasons() {
  return useLiveQuery('leaderboard', { queryKey: ['seasons'], queryFn: () => api.ranking.seasons() });
}
