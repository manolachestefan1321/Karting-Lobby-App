import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { brand } from '@config/brand';
import { CheckeredStripe, Text } from '@/components/ui';
import { api, type AppNotification } from '@/data';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { NOTIFICATION_ICON, notificationHref, notificationText } from './text';

interface BannerItem {
  key: string;
  title: string;
  body: string;
  icon: string;
  tone: 'default' | 'success' | 'danger' | 'celebrate';
  href?: string | null;
  notificationId?: string;
}

/** Global toasts ("Seat cancelled", "Results submitted"…) share the banner UI. */
export const useBanners = create<{ queue: BannerItem[]; push: (b: BannerItem) => void; shift: () => void }>((set) => ({
  queue: [],
  push: (b) => set((s) => ({ queue: [...s.queue, b] })),
  shift: () => set((s) => ({ queue: s.queue.slice(1) })),
}));

export function toast(body: string, tone: BannerItem['tone'] = 'success') {
  useBanners.getState().push({ key: `${Date.now()}-${Math.random()}`, title: brand.name, body, icon: tone === 'danger' ? 'alert-circle' : 'checkmark-circle', tone });
}

/**
 * Shows new notifications as in-app banners at the top of the screen (what push
 * notifications will look like while the app is open). Tap to open the related screen.
 */
export function BannerHost({ enabled }: { enabled: boolean }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { queue, push, shift } = useBanners();
  const current = queue[0];
  const anim = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState<BannerItem | null>(null);

  useEffect(() => {
    if (!enabled) return;
    return api.notifications.onNew((n: AppNotification) => {
      if (n.type === 'rank_up') return; // full-screen RankUpCelebration instead
      const { title, body } = notificationText(n, t, i18n.language);
      const tone = n.type === 'ban_started' || n.type.includes('cancelled') ? 'danger' : 'default';
      push({ key: n.id, title, body, icon: NOTIFICATION_ICON[n.type], tone, href: notificationHref(n), notificationId: n.id });
    });
  }, [enabled, t, i18n.language, push]);

  // Show the next queued banner when none is visible.
  useEffect(() => {
    if (!current || visible) return;
    setVisible(current);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  }, [current, visible, anim]);

  // Auto-hide the visible banner.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => hide(), visible.tone === 'celebrate' ? 6000 : 4500);
    return () => clearTimeout(timer);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const hide = () => {
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(null);
      shift();
    });
  };

  if (!visible) return null;
  const celebrate = visible.tone === 'celebrate';
  const accent = visible.tone === 'danger' ? colors.danger : visible.tone === 'success' ? colors.success : colors.accent;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + spacing.sm, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-80, 0] }) }] }]}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={`${visible.title}. ${visible.body}`}
        onPress={() => {
          if (visible.notificationId) void api.notifications.markRead(visible.notificationId);
          if (visible.href) router.push(visible.href as never);
          hide();
        }}
        style={[styles.card, { backgroundColor: celebrate ? '#16161A' : colors.surface, borderColor: accent, shadowColor: '#000' }]}
      >
        {celebrate ? (
          <View style={styles.celebrate}>
            <CheckeredStripe squares={30} size={5} />
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: accent }]}>
            <Ionicons name={visible.icon as 'flag'} size={18} color="#fff" />
          </View>
          <View style={styles.texts}>
            <Text variant="bodyStrong" numberOfLines={1} style={celebrate ? { color: '#fff' } : undefined}>
              {visible.title}
            </Text>
            <Text variant="small" tone="muted" numberOfLines={2}>
              {visible.body}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 900 },
  card: { borderRadius: radius.lg, borderWidth: 1.5, padding: spacing.md, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8, overflow: 'hidden' },
  celebrate: { marginBottom: spacing.sm, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 2 },
});
