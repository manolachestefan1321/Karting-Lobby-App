import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useUnreadCount } from '@/features/notifications/hooks';
import { useTheme } from '@/theme/ThemeProvider';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const unstable_settings = { initialRouteName: 'sessions' };

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const unread = useUnreadCount();

  const icon =
    (active: IconName, inactive: IconName) =>
    ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
      <Ionicons name={focused ? active : inactive} size={size} color={color as string} />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62 + insets.bottom, paddingTop: 6 },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarAllowFontScaling: false,
        animation: 'shift',
      }}
    >
      <Tabs.Screen name="sessions" options={{ title: t('tabs.sessions'), tabBarIcon: icon('flag', 'flag-outline') }} />
      <Tabs.Screen name="leaderboard" options={{ title: t('tabs.leaderboard'), tabBarIcon: icon('podium', 'podium-outline') }} />
      <Tabs.Screen
        name="create"
        options={{
          title: t('tabs.create'),
          tabBarIcon: ({ size }) => (
            <View style={[styles.create, { backgroundColor: colors.accent }]}>
              <Ionicons name="add" size={size} color={colors.onAccent} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tabs.notifications'),
          tabBarIcon: icon('notifications', 'notifications-outline'),
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.onAccent, fontSize: 11 },
        }}
      />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  create: { width: 40, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', transform: [{ skewX: '-10deg' }] },
});
