import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { ProfileForm } from '@/features/profile/ProfileForm';

export default function EditProfile() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  if (!profile) return null;
  return (
    <Screen>
      <Text variant="title">{t('profile.edit')}</Text>
      <ProfileForm profile={profile} submitLabel={t('common.save')} onSaved={() => router.back()} />
    </Screen>
  );
}
