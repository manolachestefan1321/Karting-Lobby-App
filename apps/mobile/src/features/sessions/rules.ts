import { DEFAULT_MIN_AGE, DEFAULT_RULES } from '@kartup/domain';
import { DATA_SOURCE, type AppRules } from '@/data';
import { useRules } from '@/features/profile/api';

export const RULES_FALLBACK: AppRules = {
  ...DEFAULT_RULES,
  minAge: DEFAULT_MIN_AGE,
  demoInstantResults: false,
  paymentsEnabled: DATA_SOURCE === 'mock',
  checkinEnabled: DATA_SOURCE === 'mock',
};

/** Rules from the backend (configurable by admins), falling back to defaults while loading. */
export function useRulesOrDefault(): AppRules {
  return useRules().data ?? RULES_FALLBACK;
}
