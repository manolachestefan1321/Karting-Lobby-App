import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Text } from '@/components/ui';
import { CheckeredStripe } from '@/components/ui/CheckeredStripe';
import { api, type AppNotification, type RankTier } from '@/data';
import { rankById } from '@/data/ranks';
import { spacing } from '@/theme/tokens';

interface Celebration {
  notificationId: string;
  rank: RankTier;
  km: number;
  xp: number;
}

/**
 * Full-screen "RANK UP" moment when the signed-in driver reaches a new rank.
 * Minimal racing style: a checkered flag sweeps across, the new badge drops in
 * with a slight italic skew, then the totals. Tap Continue to close.
 */
export function RankUpCelebration({ enabled }: { enabled: boolean }) {
  const [queue, setQueue] = useState<Celebration[]>([]);

  useEffect(() => {
    if (!enabled) return;
    return api.notifications.onNew((n: AppNotification) => {
      if (n.type !== 'rank_up') return;
      const rank = rankById(Number(n.data.rankId));
      if (!rank) return;
      setQueue((q) => [...q, { notificationId: n.id, rank, km: Number(n.data.km ?? 0), xp: Number(n.data.xp ?? 0) }]);
    });
  }, [enabled]);

  const current = queue[0];
  if (!current) return null;
  return (
    <Overlay
      key={current.notificationId}
      item={current}
      onClose={() => {
        void api.notifications.markRead(current.notificationId);
        setQueue((q) => q.slice(1));
      }}
    />
  );
}

function Overlay({ item, onClose }: { item: Celebration; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const badge = useRef(new Animated.Value(0)).current;
  const details = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(sweep, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(badge, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(details, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [fade, sweep, badge, details]);

  const close = () => Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(onClose);
  const stripe = sweep.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] });
  const line = sweep.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });
  const km = (Math.round(item.km * 10) / 10).toLocaleString(i18n.language);
  const xp = item.xp.toLocaleString(i18n.language);

  return (
    <Animated.View accessibilityViewIsModal style={[StyleSheet.absoluteFill, styles.wrap, { opacity: fade, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}>
      <Animated.View style={[styles.stripe, { transform: [{ translateX: stripe }] }]}>
        <CheckeredStripe squares={Math.ceil(width / 8)} size={8} />
      </Animated.View>

      <View style={styles.center} accessible accessibilityRole="alert" accessibilityLabel={`${t('rankUp.label')}: ${item.rank.name}. ${t('rankUp.stats', { km, xp })}`}>
        <Text variant="label" style={styles.kicker}>
          {t('rankUp.label')}
        </Text>
        <Text variant="small" style={styles.muted}>
          {t('rankUp.reached')}
        </Text>
        <Animated.View
          style={[
            styles.badge,
            { backgroundColor: item.rank.color, opacity: badge, transform: [{ skewX: '-10deg' }, { scale: badge.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }] },
          ]}
        >
          <Text variant="display" style={styles.badgeText} numberOfLines={1} adjustsFontSizeToFit>
            {item.rank.name}
          </Text>
        </Animated.View>
        <Animated.View style={[styles.line, { backgroundColor: item.rank.color, transform: [{ translateX: line }] }]} />
        <Animated.View style={{ opacity: details }}>
          <Text variant="heading" style={styles.stats} align="center">
            {t('rankUp.stats', { km, xp })}
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: details }]}>
        <Button title={t('rankUp.continue')} onPress={close} />
      </Animated.View>

      <Animated.View style={[styles.stripe, { transform: [{ translateX: line }] }]}>
        <CheckeredStripe squares={Math.ceil(width / 8)} size={8} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(11,11,13,0.96)', zIndex: 950, justifyContent: 'space-between' },
  stripe: { marginTop: spacing.xl, marginBottom: spacing.xl, alignItems: 'flex-start', overflow: 'hidden' },
  center: { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  kicker: { color: '#E10600', letterSpacing: 4, textTransform: 'uppercase' },
  muted: { color: '#A7A9AC' },
  badge: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: 6, maxWidth: '100%' },
  badgeText: { color: '#fff', fontSize: 48, lineHeight: 52 },
  line: { height: 3, width: 120, borderRadius: 2 },
  stats: { color: '#fff' },
  footer: { paddingHorizontal: spacing.xl },
});
