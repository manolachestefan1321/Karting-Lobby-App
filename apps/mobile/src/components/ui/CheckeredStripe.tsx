import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/** A thin checkered-flag strip. Use sparingly as a racing accent. */
export function CheckeredStripe({ squares = 24, size = 6 }: { squares?: number; size?: number }) {
  const { colors } = useTheme();
  const rows = [0, 1];
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.wrap}>
      {rows.map((r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: squares }, (_, i) => (
            <View
              key={i}
              style={{ width: size, height: size, backgroundColor: (i + r) % 2 === 0 ? colors.text : 'transparent' }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { opacity: 0.85 },
  row: { flexDirection: 'row' },
});
