import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { create } from 'zustand';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

/**
 * Cross-platform confirm / prompt dialogs (React Native's Alert does nothing on the web).
 * Usage: `if (await confirmDialog({ title, message })) …`
 */
interface DialogRequest {
  kind: 'confirm' | 'prompt' | 'choice';
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive?: boolean;
  placeholder?: string;
  choices?: { value: string; label: string }[];
  resolve: (value: string | boolean | null) => void;
}

const useDialog = create<{ current: DialogRequest | null; set: (d: DialogRequest | null) => void }>((set) => ({
  current: null,
  set: (current) => set({ current }),
}));

type Common = { title: string; message?: string; confirmText: string; cancelText: string; destructive?: boolean };

export function confirmDialog(o: Common): Promise<boolean> {
  return new Promise((resolve) => useDialog.getState().set({ kind: 'confirm', ...o, resolve: (v) => resolve(v === true) }));
}

export function promptDialog(o: Common & { placeholder?: string }): Promise<string | null> {
  return new Promise((resolve) => useDialog.getState().set({ kind: 'prompt', ...o, resolve: (v) => resolve(typeof v === 'string' ? v : null) }));
}

export function choiceDialog(o: Omit<Common, 'confirmText'> & { choices: { value: string; label: string }[] }): Promise<string | null> {
  return new Promise((resolve) => useDialog.getState().set({ kind: 'choice', confirmText: '', ...o, resolve: (v) => resolve(typeof v === 'string' ? v : null) }));
}

export function DialogHost() {
  const { colors } = useTheme();
  const { current, set } = useDialog();
  const [text, setText] = useState('');
  if (!current) return null;
  const close = (value: string | boolean | null) => {
    current.resolve(value);
    set(null);
    setText('');
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close(null)}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close(null)} accessibilityLabel={current.cancelText} />
        <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityViewIsModal>
          <Text variant="heading">{current.title}</Text>
          {current.message ? <Text tone="muted">{current.message}</Text> : null}
          {current.kind === 'prompt' ? (
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={current.placeholder}
              placeholderTextColor={colors.textFaint}
              multiline
              autoFocus
              accessibilityLabel={current.title}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
            />
          ) : null}
          {current.kind === 'choice' ? (
            <View style={styles.choices}>
              {current.choices!.map((c) => (
                <Button key={c.value} title={c.label} variant="secondary" size="md" onPress={() => close(c.value)} />
              ))}
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button title={current.cancelText} variant="ghost" size="md" fullWidth={false} onPress={() => close(current.kind === 'confirm' ? false : null)} />
            {current.kind !== 'choice' ? (
              <Button
                title={current.confirmText}
                variant={current.destructive ? 'danger' : 'primary'}
                size="md"
                fullWidth={false}
                disabled={current.kind === 'prompt' && !text.trim()}
                onPress={() => close(current.kind === 'confirm' ? true : text.trim())}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  box: { width: '100%', maxWidth: 420, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.md },
  input: { minHeight: 90, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, fontSize: 16, textAlignVertical: 'top' },
  choices: { gap: spacing.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
