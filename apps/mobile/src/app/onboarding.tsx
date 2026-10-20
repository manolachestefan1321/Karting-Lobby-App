import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CheckeredStripe, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { ProfileForm } from '@/features/profile/ProfileForm';
import { spacing } from '@/theme/tokens';

export default function Onboarding() {
  const { t } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  if (!profile) return null;
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <CheckeredStripe squares={16} size={5} />
        <Text variant="title">{t('onboarding.title')}</Text>
        <Text tone="muted">{t('onboarding.subtitle')}</Text>
      </View>
      {/* Saving fills the required fields; the router then switches to the main tabs. */}
      <ProfileForm profile={profile} submitLabel={t('onboarding.finish')} onSaved={() => void refreshProfile()} />
    </Screen>
  );
}

const styles = StyleSheet.create({ header: { gap: spacing.sm, paddingTop: spacing.lg } });
