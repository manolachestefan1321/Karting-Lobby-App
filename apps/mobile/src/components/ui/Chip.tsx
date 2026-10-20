import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

export function Chip({
  label,
  selected,
  onPress,
  icon,
  tone,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ComponentProps<typeof Ionicons>['name'];
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent';
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const toneColor = tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : tone === 'danger' ? colors.danger : tone === 'accent' ? colors.accent : null;
  const bg = selected ? colors.accent : toneColor ? 'transparent' : colors.surfaceAlt;
  const fg = selected ? colors.onAccent : toneColor ?? colors.text;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: bg, borderColor: toneColor ?? (selected ? colors.accent : colors.border) },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text variant="small" style={{ color: fg, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    minHeight: 34,
  },
});
