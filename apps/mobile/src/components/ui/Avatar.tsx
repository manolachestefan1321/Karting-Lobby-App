import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export interface AvatarProps {
  uri: string | null | undefined;
  name: string;
  size?: number;
  ringColor?: string;
}

export function Avatar({ uri, name, size = 48, ringColor }: AvatarProps) {
  const { colors } = useTheme();
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  const ring = ringColor ? { borderWidth: Math.max(2, size / 24), borderColor: ringColor } : null;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceAlt }, ring]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: size / 2 }} contentFit="cover" transition={150} />
      ) : (
        <Text variant="heading" tone="muted" style={{ fontSize: size * 0.38, lineHeight: size * 0.44 }}>
          {initials || '?'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
