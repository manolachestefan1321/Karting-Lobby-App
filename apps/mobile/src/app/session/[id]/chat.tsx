import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Avatar, choiceDialog, EmptyState, LoadingState, Text } from '@/components/ui';
import { api, type ChatMessage } from '@/data';
import { useMyId } from '@/features/auth/AuthProvider';
import { toast } from '@/features/notifications/BannerHost';
import { useMessages, useSendMessage, useSession } from '@/features/sessions/hooks';
import { errorText } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, spacing } from '@/theme/tokens';

const REASONS = ['harassment', 'spam', 'inappropriate', 'impersonation', 'other'] as const;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const myId = useMyId();
  const session = useSession(id);
  const messages = useMessages(id);
  const send = useSendMessage();
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const tz = session.data?.track.timezone ?? 'Europe/Bucharest';

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.data?.length]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    send.mutate({ id, body }, { onError: (e) => toast(errorText(e, t as never, i18n.language), 'danger') });
  };

  const moderate = async (m: ChatMessage) => {
    const action = await choiceDialog({
      title: `${m.author.firstName} ${m.author.lastName}`,
      cancelText: t('common.cancel'),
      choices: [
        { value: 'report', label: t('lobby.reportMessage') },
        { value: 'block', label: t('profile.block') },
      ],
    });
    if (action === 'report') {
      const reason = await choiceDialog({ title: t('profile.reportTitle'), cancelText: t('common.cancel'), choices: REASONS.map((r) => ({ value: r, label: t(`profile.reportReasons.${r}`) })) });
      if (reason) {
        await api.moderation.report({ kind: 'message', messageId: m.id }, reason);
        toast(t('profile.reportSent'));
      }
    } else if (action === 'block') {
      await api.moderation.block(m.author.id);
      toast(t('profile.blocked'));
      void messages.refetch();
    }
  };

  if (messages.isPending) return <LoadingState />;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={styles.header}>
          <Text variant="heading" numberOfLines={1}>
            {session.data?.track.name ?? t('lobby.chat')}
          </Text>
          <Text variant="caption" tone="muted">
            {t('lobby.chat')}
          </Text>
        </View>
        <FlatList
          ref={listRef}
          data={messages.data ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title={t('lobby.noMessages')} />}
          renderItem={({ item: m }) => {
            if (m.system) {
              return (
                <Text variant="caption" tone="faint" align="center" style={styles.system}>
                  {t(m.body === 'left' ? 'lobby.left' : 'lobby.joined', { name: m.author.firstName })} · {formatTime(m.createdAt, tz, i18n.language)}
                </Text>
              );
            }
            const mine = m.author.id === myId;
            return (
              <View style={[styles.msgRow, mine && styles.msgRowMine]}>
                {!mine ? <Avatar uri={m.author.avatarUrl} name={`${m.author.firstName} ${m.author.lastName}`} size={30} /> : null}
                <Pressable
                  onLongPress={mine ? undefined : () => void moderate(m)}
                  onPress={mine ? undefined : () => void moderate(m)}
                  accessibilityHint={mine ? undefined : t('lobby.reportMessage')}
                  style={[styles.bubble, { backgroundColor: mine ? colors.accent : colors.surface, borderColor: colors.border }]}
                >
                  {!mine ? (
                    <Text variant="caption" tone="accent" style={styles.author}>
                      {m.author.firstName}
                    </Text>
                  ) : null}
                  <Text style={{ color: mine ? colors.onAccent : colors.text }}>{m.body}</Text>
                  <Text variant="caption" style={{ color: mine ? 'rgba(255,255,255,0.75)' : colors.textFaint, alignSelf: 'flex-end' }}>
                    {formatTime(m.createdAt, tz, i18n.language)}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
        <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('lobby.chatPlaceholder')}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={t('lobby.chatPlaceholder')}
            onSubmitEditing={submit}
            returnKeyType="send"
            maxLength={1000}
            style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
          />
          <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel={t('common.send')} style={[styles.send, { backgroundColor: colors.accent }]}>
            <Ionicons name="send" size={18} color={colors.onAccent} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  system: { marginVertical: spacing.xs },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, maxWidth: '85%' },
  msgRowMine: { alignSelf: 'flex-end' },
  bubble: { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: StyleSheet.hairlineWidth, gap: 2, flexShrink: 1 },
  author: { fontWeight: '700' },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.lg, fontSize: 16 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
