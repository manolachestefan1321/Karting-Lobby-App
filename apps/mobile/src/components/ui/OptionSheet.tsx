import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { ListRow } from './ListRow';
import { Text } from './Text';

export interface SheetOption {
  label: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  destructive?: boolean;
  onPress: () => void;
}

/** Bottom sheet with a list of actions (cross-platform replacement for action sheets). */
export function OptionSheet({
  visible,
  title,
  options,
  onClose,
}: {
  visible: boolean;
  title?: string;
  options: SheetOption[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel={t('common.cancel')} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.sm }]}>
        {title ? (
          <Text variant="label" tone="muted" style={styles.title}>
            {title}
          </Text>
        ) : null}
        {options.map((o) => (
          <ListRow
            key={o.label}
            title={o.label}
            icon={o.icon}
            destructive={o.destructive}
            chevron={false}
            onPress={() => {
              onClose();
              o.onPress();
            }}
          />
        ))}
        <ListRow title={t('common.cancel')} icon="close" chevron={false} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: spacing.md },
  title: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
