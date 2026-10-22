import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, ErrorState, ListRow, Card, LoadingState, promptDialog, Screen, Text } from '@/components/ui';
import { useMyId } from '@/features/auth/AuthProvider';
import { toast } from '@/features/notifications/BannerHost';
import { useAppealBan, useCities, useProgressHistory, usePublicProfile, useRankTiers, useTrackExperience } from '@/features/profile/api';
import { ProfileView } from '@/features/profile/ProfileView';
import { errorText } from '@/lib/errors';
import { useTheme } from '@/theme/ThemeProvider';
import { spacing } from '@/theme/tokens';

export default function MyProfile() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const userId = useMyId();
  const profile = usePublicProfile(userId);
  const tiers = useRankTiers();
  const experience = useTrackExperience(userId);
  const history = useProgressHistory(userId);
  const cities = useCities();
  const appeal = useAppealBan();

  const refreshing = profile.isRefetching || experience.isRefetching;
  const refresh = () => {
    void profile.refetch();
    void experience.refetch();
  };

  const ban = profile.data?.activeBan;
  const onAppeal = async () => {
    if (!ban) return;
    const message = await promptDialog({ title: t('profile.appealTitle'), placeholder: t('profile.appealPlaceholder'), confirmText: t('common.send'), cancelText: t('common.cancel') });
    if (message) appeal.mutate({ banId: ban.id, message }, { onSuccess: () => toast(t('profile.appealSent')), onError: (e) => toast(errorText(e, t as never, i18n.language), 'danger') });
  };

  return (
    <Screen edges={['top']} refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.topBar}>
        <Text variant="title" style={styles.flex}>
          {t('tabs.profile')}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profile.settings')} hitSlop={12} onPress={() => router.push('/settings')}>
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
          cityName={cities.data?.find((c) => c.id === profile.data!.homeCityId)?.name}
          actions={<Button title={t('profile.edit')} variant="secondary" fullWidth={false} size="md" onPress={() => router.push('/profile/edit')} />}
          banAction={ban && ban.appealStatus === 'none' ? <Button title={t('profile.appeal')} variant="secondary" size="md" onPress={() => void onAppeal()} loading={appeal.isPending} /> : undefined}
          onExperiencePress={(trackId) => router.push({ pathname: '/profile/experience', params: { trackId } })}
          experienceAction={
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/profile/experience')}>
              <Text tone="accent" variant="bodyStrong">
                + {t('profile.addExperience')}
              </Text>
            </Pressable>
          }
          footer={
            <Card padded={false}>
              <ListRow
                icon="trending-up-outline"
                title={t('profile.raceHistory')}
                subtitle={
                  history.data?.[0]
                    ? `${history.data[0].xp !== null ? `${history.data[0].xp >= 0 ? '+' : '−'}${Math.abs(history.data[0].xp)} XP` : history.data[0].casual ? t('lobbyType.casual') : t('profile.unverified')} · ${history.data[0].trackName}`
                    : t('profile.noRaces')
                }
                onPress={() => router.push('/profile/history')}
              />
              <ListRow icon="add-circle-outline" title={t('profile.addRace')} subtitle={t('profile.unverified')} onPress={() => router.push('/profile/self-report')} />
            </Card>
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
