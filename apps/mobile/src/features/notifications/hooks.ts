import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type NotificationPrefs } from '@/data';
import { useLiveQuery } from '@/lib/live';

export function useNotifications() {
  return useLiveQuery('notifications', { queryKey: ['notifications'], queryFn: () => api.notifications.list() });
}

export function useUnreadCount() {
  const q = useNotifications();
  return q.data?.filter((n) => !n.readAt).length ?? 0;
}

export function useNotificationPrefs() {
  return useLiveQuery('me', { queryKey: ['notification_prefs'], queryFn: () => api.notifications.prefs() });
}

export function useSetNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (p: NotificationPrefs) => api.notifications.setPrefs(p), onSettled: () => qc.invalidateQueries() });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.notifications.markAllRead(), onSettled: () => qc.invalidateQueries() });
}
