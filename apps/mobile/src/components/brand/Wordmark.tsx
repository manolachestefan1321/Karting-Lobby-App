import { StyleSheet, View } from 'react-native';
import { brand } from '@config/brand';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

/**
 * The KartUP wordmark (temporary text logo): "Kart" + "UP" in the accent color,
 * bold italic condensed, a small checkered flag, and the slogan underneath.
 * The name is always rendered exactly as in config/brand.ts — never upper/lower-cased.
 */
export function Wordmark({ size = 56, slogan = true, align = 'left' }: { size?: number; slogan?: boolean; align?: 'left' | 'center' }) {
  const { colors } = useTheme();
  const sq = Math.max(3, Math.round(size * 0.085));
  return (
    <View style={[styles.wrap, align === 'center' && styles.center]} accessible accessibilityRole="header" accessibilityLabel={`${brand.name}. ${brand.slogan}`}>
      <View style={styles.row}>
        <Text
          maxFontSizeMultiplier={1.2}
          style={{ fontFamily: fonts.wordmark, fontSize: size, lineHeight: size * 1.05, color: colors.text, letterSpacing: size * 0.01 }}
        >
          {brand.wordmark.lead}
          <Text style={{ fontFamily: fonts.wordmark, fontSize: size, color: colors.accent }}>{brand.wordmark.accent}</Text>
        </Text>
        <View style={[styles.flag, { marginTop: size * 0.12, marginLeft: size * 0.06 }]} accessible={false}>
          {[0, 1, 2].map((r) => (
            <View key={r} style={styles.flagRow}>
              {[0, 1, 2, 3].map((c) => (
                <View key={c} style={{ width: sq, height: sq, backgroundColor: (r + c) % 2 === 0 ? colors.text : 'transparent' }} />
              ))}
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.speed, { backgroundColor: colors.accent, width: size * 1.6, height: Math.max(3, size * 0.07) }, align === 'center' && styles.speedCenter]} />
      {slogan ? (
        <Text tone="muted" maxFontSizeMultiplier={1.4} style={{ fontFamily: fonts.headingMedium, fontSize: Math.max(15, size * 0.3), letterSpacing: 0.6, marginTop: size * 0.14 }}>
          {brand.slogan}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start' },
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  flag: {},
  flagRow: { flexDirection: 'row' },
  speed: { transform: [{ skewX: '-30deg' }], marginTop: 2 },
  speedCenter: { alignSelf: 'center' },
});
