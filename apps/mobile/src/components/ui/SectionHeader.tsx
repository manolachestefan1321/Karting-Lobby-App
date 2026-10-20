import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { Text } from './Text';

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header">
      <View style={[styles.bar, { backgroundColor: colors.accent }]} />
      <Text variant="label" tone="muted" style={styles.title}>
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bar: { width: 3, height: 14, borderRadius: 2, transform: [{ skewX: '-12deg' }] },
  title: { flex: 1 },
});
