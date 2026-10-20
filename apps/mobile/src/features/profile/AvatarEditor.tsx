import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar, OptionSheet, Text, type SheetOption } from '@/components/ui';
import { pickSquareImage, type ImageSource } from '@/lib/image';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';
import { useRemoveAvatar, useUploadAvatar } from './api';

export function AvatarEditor({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [sheet, setSheet] = useState(false);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const busy = upload.isPending || remove.isPending;

  const choose = async (source: ImageSource) => {
    const result = await pickSquareImage(source);
    if (result.status === 'denied') return Alert.alert(t('photo.title'), t('photo.permissionDenied'));
    if (result.status !== 'ok') return;
    upload.mutate(result.uri, { onError: () => Alert.alert(t('photo.title'), t('photo.uploadFailed')) });
  };

  const options: SheetOption[] = [
    ...(Platform.OS !== 'web' ? [{ label: t('photo.takePhoto'), icon: 'camera-outline' as const, onPress: () => void choose('camera') }] : []),
    { label: t('photo.chooseFromLibrary'), icon: 'images-outline', onPress: () => void choose('library') },
    ...(avatarUrl ? [{ label: t('photo.remove'), icon: 'trash-outline' as const, destructive: true, onPress: () => remove.mutate() }] : []),
  ];

  return (
    <View style={styles.center}>
      <Pressable accessibilityRole="button" accessibilityLabel={avatarUrl ? t('photo.change') : t('photo.add')} onPress={() => setSheet(true)} disabled={busy}>
        <Avatar uri={avatarUrl} name={name} size={112} ringColor={colors.accent} />
        <View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.background }]}>
          {busy ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Ionicons name="camera" size={18} color={colors.onAccent} />}
        </View>
      </Pressable>
      <Text variant="small" tone="accent">
        {avatarUrl ? t('photo.change') : t('photo.add')}
      </Text>
      <OptionSheet visible={sheet} title={t('photo.title')} options={options} onClose={() => setSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm },
  badge: { position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
});
