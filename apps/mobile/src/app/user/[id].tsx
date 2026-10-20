import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, choiceDialog, confirmDialog, EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui';
import { api } from '@/data';
import { toast } from '@/features/notifications/BannerHost';
import { useCities, usePublicProfile, useRankTiers, useTrackExperience } from '@/features/profile/api';
import { ProfileView } from '@/features/profile/ProfileView';
import { spacing } from '@/theme/tokens';

const REASONS = ['harassment', 'spam', 'inappropriate', 'impersonation', 'other'] as const;

/** Another driver's public profile, with report and block (required by the app stores). */
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
  const name = `${profile.data.firstName} ${profile.data.lastName}`;

  const report = async () => {
    const reason = await choiceDialog({ title: t('profile.reportTitle'), cancelText: t('common.cancel'), choices: REASONS.map((r) => ({ value: r, label: t(`profile.reportReasons.${r}`) })) });
    if (!reason) return;
    await api.moderation.report({ kind: 'profile', userId: id }, reason);
    toast(t('profile.reportSent'));
  };
  const block = async () => {
    if (!(await confirmDialog({ title: t('profile.block'), message: t('profile.blockConfirm', { name }), confirmText: t('profile.block'), cancelText: t('common.cancel'), destructive: true }))) return;
    await api.moderation.block(id);
    toast(t('profile.blocked'));
  };

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      <ProfileView
        profile={profile.data}
        tiers={tiers.data ?? []}
        experience={experience.data ?? []}
        cityName={cities.data?.find((c) => c.id === profile.data!.homeCityId)?.name}
        actions={
          <View style={styles.actions}>
            <Button title={t('profile.report')} variant="secondary" size="md" fullWidth={false} onPress={() => void report()} />
            <Button title={t('profile.block')} variant="danger" size="md" fullWidth={false} onPress={() => void block()} />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', gap: spacing.sm } });
