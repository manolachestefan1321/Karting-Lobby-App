import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { CheckeredStripe } from '@/components/ui/CheckeredStripe';
import { brand } from '@config/brand';
import { useTheme } from '@/theme/ThemeProvider';
import { Wordmark } from './Wordmark';

/**
 * In-app continuation of the native splash screen: wordmark + slogan on the brand
 * background, then a quick fade into the app. Also what you see in the web preview.
 */
export function AnimatedSplash({ ready }: { ready: boolean }) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(24)).current;
  const [done, setDone] = useState(false);

  useEffect(() => {
    Animated.timing(slide, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [slide]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => setDone(true));
    }, 1100);
    return () => clearTimeout(t);
  }, [ready, opacity]);

  if (done) return null;
  return (
    <Animated.View pointerEvents={ready ? 'none' : 'auto'} style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: brand.colors.splashBackground, opacity }]}>
      <Animated.View style={{ transform: [{ translateX: slide }] }}>
        <Wordmark size={64} align="center" />
      </Animated.View>
      <View style={styles.bottom}>
        <CheckeredStripe squares={20} size={6} />
      </View>
      <View style={[styles.accent, { backgroundColor: colors.accent }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  bottom: { position: 'absolute', bottom: 48 },
  accent: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 },
});
