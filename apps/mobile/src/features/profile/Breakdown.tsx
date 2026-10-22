import type { XpBreakdown } from '@kartup/domain';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';

/** "Participation 25 · Position 75 · New track 30 · Official event × 1.5" */
export function Breakdown({ b }: { b: XpBreakdown }) {
  const { t } = useTranslation();
  const parts = (['participation', 'position', 'podium', 'fastestLap', 'personalBest', 'newTrack'] as const)
    .filter((k) => b[k] > 0)
    .map((k) => `${t(`profile.breakdown.${k}`)} ${b[k]}`);
  if (b.multiplier !== 1) parts.push(t('profile.breakdown.official', { multiplier: b.multiplier }));
  return (
    <Text variant="caption" tone="faint">
      {parts.join(' · ')}
    </Text>
  );
}
