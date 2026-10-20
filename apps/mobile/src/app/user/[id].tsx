import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { useCities, usePublicProfile, useRankTiers, useTrackExperience } from '@/features/profile/api';
import { ProfileView } from '@/features/profile/ProfileView';

/** Another driver's public profile. (Report & block buttons arrive with moderation.) */
export default function PublicProfileScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = usePublicProfile(id);
  const tiers = useRankTiers();
  const experience = useTrackExperience(id);
  const cities = useCities();

  if (profile.isPending || tiers.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} />;
  if (!profile.data) {
    return (
      <Screen scroll={false}>
        <EmptyState icon="person-outline" title={t('profile.notFound')} />
      </Screen>
    );
  }
  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      <ProfileView
        profile={profile.data}
        tiers={tiers.data ?? []}
        experience={experience.data ?? []}
        cityName={cities.data?.find((c) => c.id === profile.data!.home_city_id)?.name}
      />
    </Screen>
  );
}
