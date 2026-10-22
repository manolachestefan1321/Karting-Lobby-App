import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type CreateSessionInput, type SessionFilters } from '@/data';
import { useLiveQuery } from '@/lib/live';

export function useSessions(filters: SessionFilters | null) {
  return useLiveQuery('sessions', {
    queryKey: ['sessions', filters],
    enabled: !!filters,
    queryFn: () => api.sessions.list(filters!),
  });
}

export function useMySessions() {
  return useLiveQuery('sessions', { queryKey: ['sessions', 'mine'], queryFn: () => api.sessions.mine() });
}

export function useSession(id: string | undefined) {
  return useLiveQuery(`session:${id}`, { queryKey: ['session', id], enabled: !!id, queryFn: () => api.sessions.get(id!) });
}

export function useMembers(id: string | undefined) {
  return useLiveQuery(`session:${id}`, { queryKey: ['session', id, 'members'], enabled: !!id, queryFn: () => api.sessions.members(id!) });
}

export function useMessages(id: string | undefined, enabled = true) {
  return useLiveQuery(`session:${id}`, { queryKey: ['session', id, 'messages'], enabled: !!id && enabled, queryFn: () => api.sessions.messages(id!) });
}

export function useResults(id: string | undefined) {
  return useLiveQuery(`session:${id}`, { queryKey: ['session', id, 'results'], enabled: !!id, queryFn: () => api.results.get(id!) });
}

export function usePaymentHistory() {
  return useLiveQuery('me', { queryKey: ['payments'], queryFn: () => api.payments.history() });
}

/** All session mutations refresh every query afterwards (lists, lobby, profile, notifications). */
function useAction<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => qc.invalidateQueries() });
}

export const useEnterLobby = () => useAction((id: string) => api.sessions.enterLobby(id));
export const useLeaveLobby = () => useAction((id: string) => api.sessions.leaveLobby(id));
export const useCancelSeat = () => useAction((id: string) => api.sessions.cancelSeat(id));
export const useRemoveMember = () => useAction(({ id, userId }: { id: string; userId: string }) => api.sessions.removeMember(id, userId));
export const useCancelSession = () => useAction(({ id, reason }: { id: string; reason: string }) => api.sessions.cancelSession(id, reason));
export const useCheckIn = () => useAction((id: string) => api.sessions.checkIn(id));
export const useConfirmAttendance = () =>
  useAction(({ id, userId, attended }: { id: string; userId: string; attended: boolean }) => api.sessions.confirmAttendance(id, userId, attended));
export const useSendMessage = () => useAction(({ id, body }: { id: string; body: string }) => api.sessions.sendMessage(id, body));
export const useCreateSession = () => useAction((input: CreateSessionInput) => api.sessions.create(input));
export const useSubmitResults = () =>
  useAction(
    ({ id, entries, printoutUri }: { id: string; entries: { userId: string; position: number; laps: number; bestLapMs: number | null }[]; printoutUri: string | null }) =>
      api.results.submit(id, { entries, printoutUri }),
  );
export const useRespondResults = () =>
  useAction(({ id, response, comment }: { id: string; response: 'confirm' | 'dispute'; comment?: string }) => api.results.respond(id, response, comment));
