import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Button } from './Button';
import { Text } from './Text';
import { TextField } from './TextField';

/** Converts a picker Date (local midnight) to a calendar string without time-zone shifts. */
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromIsoDate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** Calendar-date field (value is "YYYY-MM-DD"). */
export function DateField({
  label,
  value,
  onChange,
  error,
  hint,
  maximumDate,
  minimumDate = new Date(1900, 0, 1),
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  maximumDate?: Date;
  minimumDate?: Date;
}) {
  const { colors, scheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(fromIsoDate(value) ?? new Date(2000, 0, 1));
  const date = fromIsoDate(value);
  const display = date ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(date) : t('common.select');

  if (Platform.OS === 'web') {
    return <TextField label={label} value={value ?? ''} onChangeText={onChange} placeholder="YYYY-MM-DD" error={error} hint={hint} />;
  }

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date ?? new Date(2000, 0, 1),
        mode: 'date',
        maximumDate,
        minimumDate,
        onChange: (event, selected) => {
          if (event.type === 'set' && selected) onChange(toIsoDate(selected));
        },
      });
    } else {
      setDraft(date ?? new Date(2000, 0, 1));
      setIosOpen(true);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display}`}
        onPress={open}
        style={[styles.field, { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border }]}
      >
        <Text tone={date ? 'default' : 'faint'} style={styles.flex}>
          {display}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" tone="faint">
          {hint}
        </Text>
      ) : null}

      <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
        <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <DateTimePicker
              value={draft}
              mode="date"
              display="spinner"
              maximumDate={maximumDate}
              minimumDate={minimumDate}
              themeVariant={scheme}
              locale={i18n.language}
              onChange={(_, selected) => selected && setDraft(selected)}
            />
            <Button
              title={t('common.done')}
              onPress={() => {
                onChange(toIsoDate(draft));
                setIosOpen(false);
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  flex: { flex: 1 },
  field: {
    minHeight: 50,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: spacing.xxl },
});
