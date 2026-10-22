import { Platform, StyleSheet, Switch, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * The app's on/off switch: accent track when on, neutral grey when off, white thumb
 * in both states (theme tokens toggleOn / toggleOff / toggleThumb).
 * Disabled toggles (e.g. "always on" settings) keep their value but look muted.
 */
export function Toggle({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  // The web Switch ignores thumbColor when on and falls back to its own teal; these props fix that.
  const webColors = Platform.OS === 'web' ? { activeThumbColor: colors.toggleThumb, activeTrackColor: colors.toggleOn } : {};
  return (
    <View style={disabled ? styles.muted : undefined}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.toggleOn, false: colors.toggleOff }}
        thumbColor={colors.toggleThumb}
        ios_backgroundColor={colors.toggleOff}
        accessibilityLabel={accessibilityLabel}
        {...(webColors as object)}
      />
    </View>
  );
}

const styles = StyleSheet.create({ muted: { opacity: 0.45 } });
