import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Text } from './Text';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, style, multiline, secureTextEntry, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  // Password fields get an eye button so people can check what they typed.
  const [revealed, setRevealed] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.border;
  return (
    <View style={styles.wrapper}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View style={styles.row}>
      <TextInput
        ref={ref}
        secureTextEntry={!!secureTextEntry && !revealed}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.accent}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && styles.multiline,
          secureTextEntry && styles.withEye,
          { color: colors.text, backgroundColor: colors.surface, borderColor },
          style,
        ]}
        maxFontSizeMultiplier={1.6}
        {...rest}
      />
      {secureTextEntry ? (
        <Pressable
          onPress={() => setRevealed((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={revealed ? t('common.hidePassword') : t('common.showPassword')}
          hitSlop={8}
          style={styles.eye}
        >
          <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
        </Pressable>
      ) : null}
      </View>
      {error ? (
        <Text variant="small" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" tone="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  row: { position: 'relative', justifyContent: 'center' },
  withEye: { paddingRight: 48 },
  eye: { position: 'absolute', right: spacing.sm, height: 40, width: 40, alignItems: 'center', justifyContent: 'center' },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
});
