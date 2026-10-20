import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCities, usePublicProfile, useRankTiers, useTrackExperience } from '@/features/profile/api';
import { ProfileView } from '@/features/profile/ProfileView';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function MyProfile() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id;
  const profile = usePublicProfile(userId);
  const tiers = useRankTiers();
  const experience = useTrackExperience(userId);
  const cities = useCities();

  const refreshing = profile.isRefetching || experience.isRefetching;
  const refresh = () => {
    void profile.refetch();
    void experience.refetch();
  };

  return (
    <Screen edges={['top']} refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.topBar}>
        <Text variant="title" style={styles.flex}>
          {t('tabs.profile')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.settings')}
          hitSlop={12}
          onPress={() => router.push('/settings')}
        >
          <Ionicons name="settings-outline" size={24} color={colors.text} />
        </Pressable>
      </View>
      {profile.isPending || tiers.isPending ? (
        <LoadingState />
      ) : profile.isError || !profile.data ? (
        <ErrorState onRetry={refresh} />
      ) : (
        <ProfileView
          profile={profile.data}
          tiers={tiers.data ?? []}
          experience={experience.data ?? []}
          cityName={cities.data?.find((c) => c.id === profile.data!.home_city_id)?.name}
          actions={<Button title={t('profile.edit')} variant="secondary" fullWidth={false} size="md" onPress={() => router.push('/profile/edit')} />}
          onExperiencePress={(trackId) => router.push({ pathname: '/profile/experience', params: { trackId } })}
          experienceAction={
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/profile/experience')}>
              <Text tone="accent" variant="bodyStrong">
                + {t('profile.addExperience')}
              </Text>
            </Pressable>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
