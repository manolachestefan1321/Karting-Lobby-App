import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

export function Checkbox({
  checked,
  onChange,
  children,
  accessibilityLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={accessibilityLabel}
        hitSlop={12}
        onPress={() => onChange(!checked)}
        style={[
          styles.box,
          { borderColor: checked ? colors.accent : colors.border, backgroundColor: checked ? colors.accent : 'transparent' },
        ]}
      >
        {checked ? <Ionicons name="checkmark" size={18} color={colors.onAccent} /> : null}
      </Pressable>
      <View style={styles.label}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  box: { width: 26, height: 26, borderRadius: radius.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  label: { flex: 1 },
});
