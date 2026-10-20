import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, EmptyState, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { api } from '@/data';
import { useMarkAllRead, useNotifications } from '@/features/notifications/hooks';
import { NOTIFICATION_ICON, notificationHref, notificationText } from '@/features/notifications/text';
import { relative } from '@/lib/format';
import { useNow } from '@/lib/live';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function NotificationsTab() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const now = useNow(30_000);
  const list = useNotifications();
  const markAll = useMarkAllRead();
  const unread = list.data?.some((n) => !n.readAt);

  return (
    <Screen edges={['top']} refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <View style={styles.titleRow}>
        <Text variant="title" style={styles.flex}>
          {t('notifications.title')}
        </Text>
        {unread ? (
          <Pressable onPress={() => markAll.mutate()} accessibilityRole="button" hitSlop={8}>
            <Text tone="accent" variant="bodyStrong">
              {t('notifications.markAllRead')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {list.isPending ? (
        <LoadingState />
      ) : list.isError ? (
        <ErrorState onRetry={() => void list.refetch()} />
      ) : !list.data?.length ? (
        <EmptyState icon="notifications-outline" title={t('notifications.emptyTitle')} body={t('notifications.emptyBody')} />
      ) : (
        <Card padded={false}>
          {list.data.map((n) => {
            const { title, body } = notificationText(n, t, i18n.language);
            const href = notificationHref(n);
            const danger = n.type === 'ban_started' || n.type.includes('cancelled');
            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                accessibilityLabel={`${title}. ${body}`}
                onPress={() => {
                  if (!n.readAt) void api.notifications.markRead(n.id);
                  if (href) router.push(href as never);
                }}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}
              >
                <View style={[styles.icon, { backgroundColor: danger ? colors.danger : n.type === 'rank_up' ? '#E5A000' : colors.surfaceAlt }]}>
                  <Ionicons name={NOTIFICATION_ICON[n.type] as 'flag'} size={18} color={danger || n.type === 'rank_up' ? '#fff' : colors.text} />
                </View>
                <View style={styles.flex}>
                  <Text variant={n.readAt ? 'body' : 'bodyStrong'} numberOfLines={1}>
                    {title}
                  </Text>
                  <Text variant="small" tone="muted" numberOfLines={2}>
                    {body}
                  </Text>
                  <Text variant="caption" tone="faint">
                    {relative(n.createdAt, now, i18n.language)}
                  </Text>
                </View>
                {!n.readAt ? <View style={[styles.unread, { backgroundColor: colors.accent }]} /> : null}
              </Pressable>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'center' },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  unread: { width: 10, height: 10, borderRadius: 5 },
});
