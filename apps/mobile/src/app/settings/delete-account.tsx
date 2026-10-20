import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, confirmDialog, Screen, Text } from '@/components/ui';
import { api } from '@/data';
import { toast } from '@/features/notifications/BannerHost';
import { errorText } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function DeleteAccount() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    const ok = await confirmDialog({ title: t('deleteAccount.confirmTitle'), message: t('deleteAccount.confirmBody'), confirmText: t('deleteAccount.confirm'), cancelText: t('common.cancel'), destructive: true });
    if (!ok) return;
    setLoading(true);
    try {
      await api.auth.deleteAccount();
      toast(t('deleteAccount.deleted'));
    } catch (err) {
      toast(errorText(err, t as never, i18n.language), 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen footer={<Button title={t('deleteAccount.confirm')} variant="danger" onPress={() => void confirm()} loading={loading} />}>
      <View style={styles.header}>
        <Ionicons name="warning-outline" size={40} color={colors.danger} />
        <Text variant="title">{t('deleteAccount.title')}</Text>
      </View>
      <Card style={styles.gap}>
        <Text>{t('deleteAccount.body')}</Text>
        <Text tone="muted">{t('deleteAccount.upcoming')}</Text>
        <Text tone="muted">{t('deleteAccount.payments')}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ header: { gap: spacing.sm }, gap: { gap: spacing.md } });
