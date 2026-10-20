import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Max content width, so large phones/tablets don't get over-stretched layouts. */
  maxWidth?: number;
}

export function Screen({ children, scroll = true, edges = ['bottom'], footer, refreshing, onRefresh, maxWidth = 560 }: ScreenProps) {
  const { colors } = useTheme();
  const content = <View style={[styles.content, { maxWidth }]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined
            }
          >
            {content}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.scroll]}>{content}</View>
        )}
        {footer ? <View style={[styles.footer, { borderTopColor: colors.border, maxWidth }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  content: { width: '100%', flexGrow: 1, gap: spacing.lg },
  footer: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
