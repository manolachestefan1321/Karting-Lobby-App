import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { deleteMyAccount } from '@/features/profile/api';
import { errorKey } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function DeleteAccount() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const performDelete = async () => {
    setLoading(true);
    try {
      await deleteMyAccount();
      Alert.alert(t('deleteAccount.deleted'));
      await signOut();
    } catch (err) {
      Alert.alert(t('common.errorTitle'), t(errorKey(err) as 'errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const confirm = () =>
    Alert.alert(t('deleteAccount.confirmTitle'), t('deleteAccount.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('deleteAccount.confirm'), style: 'destructive', onPress: () => void performDelete() },
    ]);

  return (
    <Screen footer={<Button title={t('deleteAccount.confirm')} variant="danger" onPress={confirm} loading={loading} />}>
      <View style={styles.header}>
        <Ionicons name="warning-outline" size={40} color={colors.danger} />
        <Text variant="title">{t('deleteAccount.title')}</Text>
      </View>
      <Card style={styles.gap}>
        <Text>{t('deleteAccount.body')}</Text>
        <Text tone="muted">{t('deleteAccount.payments')}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  gap: { gap: spacing.md },
});
