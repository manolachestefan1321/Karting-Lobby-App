import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export function ProgressBar({ progress, color, label }: { progress: number; color?: string; label?: string }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.track, { backgroundColor: colors.surfaceAlt }]}
    >
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color ?? colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
