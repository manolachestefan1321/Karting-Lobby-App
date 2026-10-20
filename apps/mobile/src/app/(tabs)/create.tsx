import { useTranslation } from 'react-i18next';
import { EmptyState, Screen, Text } from '@/components/ui';

// Built in a later step.
export default function Placeholder() {
  const { t } = useTranslation();
  return (
    <Screen edges={['top']}>
      <Text variant="title">{t('tabs.create')}</Text>
      <EmptyState icon="add-circle-outline" title={t('common.comingSoonTitle')} body={t('common.comingSoonBody')} />
    </Screen>
  );
}
