import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { typography, type TypographyVariant } from '@/theme/tokens';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  tone?: 'default' | 'muted' | 'faint' | 'accent' | 'danger' | 'success' | 'onAccent';
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', tone = 'default', align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const color = {
    default: colors.text,
    muted: colors.textMuted,
    faint: colors.textFaint,
    accent: colors.accentText,
    danger: colors.danger,
    success: colors.success,
    onAccent: colors.onAccent,
  }[tone];
  const isDisplay = variant === 'display' || variant === 'title' || variant === 'stat';
  return (
    <RNText
      maxFontSizeMultiplier={isDisplay ? 1.3 : 1.8}
      style={[typography[variant], { color, textAlign: align }, style]}
      {...rest}
    />
  );
}
