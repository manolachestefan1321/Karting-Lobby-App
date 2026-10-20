import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { EmptyState } from './States';
import { ListRow } from './ListRow';
import { Text } from './Text';

export interface PickerItem {
  value: string;
  label: string;
  subtitle?: string;
}

/** A form field that opens a searchable full-screen list. */
export function PickerField({
  label,
  placeholder,
  value,
  items,
  onChange,
  error,
  emptyText,
}: {
  label: string;
  placeholder: string;
  value: string | null | undefined;
  items: PickerItem[];
  onChange: (value: string) => void;
  error?: string;
  emptyText?: string;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = items.find((i) => i.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return items;
    const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
    return items.filter((i) => norm(i.label).includes(norm(q)));
  }, [items, query]);

  return (
    <View style={styles.wrapper}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border }]}
      >
        <Text tone={selected ? 'default' : 'faint'} style={styles.flex} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} presentationStyle="pageSheet">
        <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <Text variant="heading" style={styles.flex}>
              {label}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={12}>
              <Text tone="accent" variant="bodyStrong">
                {t('common.done')}
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('common.search')}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t('common.search')}
            style={[styles.search, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          />
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.value}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<EmptyState icon="search-outline" title={emptyText ?? t('common.search')} />}
            renderItem={({ item }) => (
              <ListRow
                title={item.label}
                subtitle={item.subtitle}
                chevron={false}
                right={item.value === value ? <Ionicons name="checkmark" size={22} color={colors.accent} /> : undefined}
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                  setQuery('');
                }}
              />
            )}
          />
        </SafeAreaView>
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
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg },
  search: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, minHeight: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: 16 },
});
