import { useQuery, useQueryClient, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, type Topic } from '@/data';

/**
 * useQuery + live updates: whenever the backend reports a change on `topic`
 * (Supabase Realtime later; the fake backend now), the query refetches.
 */
export function useLiveQuery<T>(topic: Topic, options: UseQueryOptions<T, Error, T, QueryKey> & { queryKey: QueryKey }) {
  const qc = useQueryClient();
  const key = JSON.stringify(options.queryKey);
  useEffect(() => api.realtime.subscribe(topic, () => void qc.invalidateQueries({ queryKey: options.queryKey })), [topic, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return useQuery(options);
}

/** Current time from the backend clock (the preview can move it). Re-renders every `everyMs`. */
export function useNow(everyMs = 1000): Date {
  const [now, setNow] = useState(() => api.clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(api.clock.now()), everyMs);
    const unsub = api.clock.subscribe(() => setNow(api.clock.now()));
    return () => {
      clearInterval(id);
      unsub();
    };
  }, [everyMs]);
  return now;
}
