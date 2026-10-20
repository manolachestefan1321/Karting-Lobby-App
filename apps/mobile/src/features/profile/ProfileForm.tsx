import { profileSchema, type ProfileInput } from '@kartup/domain';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Linking, StyleSheet, View } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';
import { brand } from '@config/brand';
import { Button, Checkbox, DateField, PickerField, Text, TextField } from '@/components/ui';
import { errorKey } from '@/lib/errors';
import { zodResolver } from '@/lib/zodResolver';
import type { Profile } from '@/data';
import { spacing } from '@/theme/tokens';
import { useCities, useMinAge, useSaveProfile } from './api';
import { AvatarEditor } from './AvatarEditor';

/** Used by onboarding (first time) and by "Edit profile". */
export function ProfileForm({ profile, submitLabel, onSaved }: { profile: Profile; submitLabel: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const minAge = useMinAge().data ?? 16;
  const cities = useCities();
  const save = useSaveProfile();
  const needsTerms = !profile.termsAcceptedAt;
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);

  const schema = useMemo(() => profileSchema(minAge), [minAge]);
  const { control, handleSubmit, watch, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      dateOfBirth: profile.dateOfBirth ?? '',
      homeCityId: profile.homeCityId ?? '',
      bio: profile.bio ?? '',
    },
  });
  const name = `${watch('firstName')} ${watch('lastName')}`.trim();
  const maxBirthDate = new Date();
  maxBirthDate.setFullYear(maxBirthDate.getFullYear() - minAge);

  const fieldError = (key: keyof ProfileInput) => {
    const msg = formState.errors[key]?.message;
    return msg ? t(msg as 'validation.required', { minAge }) : undefined;
  };

  const onSubmit = handleSubmit((values) => {
    if (needsTerms && !acceptTerms) return setTermsError(true);
    save.mutate({ ...values, acceptTerms: needsTerms ? acceptTerms : undefined }, { onSuccess: onSaved });
  });

  return (
    <View style={styles.form}>
      <AvatarEditor avatarUrl={profile.avatarUrl} name={name} />
      <Controller
        control={control}
        name="firstName"
        render={({ field }) => (
          <TextField
            label={t('onboarding.firstName')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoComplete="given-name"
            textContentType="givenName"
            error={fieldError('firstName')}
          />
        )}
      />
      <Controller
        control={control}
        name="lastName"
        render={({ field }) => (
          <TextField
            label={t('onboarding.lastName')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoComplete="family-name"
            textContentType="familyName"
            error={fieldError('lastName')}
          />
        )}
      />
      <Controller
        control={control}
        name="dateOfBirth"
        render={({ field }) => (
          <DateField
            label={t('onboarding.dateOfBirth')}
            value={field.value}
            onChange={field.onChange}
            maximumDate={maxBirthDate}
            hint={t('onboarding.dateOfBirthHint', { minAge })}
            error={fieldError('dateOfBirth')}
          />
        )}
      />
      <Controller
        control={control}
        name="homeCityId"
        render={({ field }) => (
          <PickerField
            label={t('onboarding.homeCity')}
            placeholder={t('onboarding.selectCity')}
            value={field.value}
            onChange={field.onChange}
            items={(cities.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            error={fieldError('homeCityId')}
          />
        )}
      />
      <Controller
        control={control}
        name="bio"
        render={({ field }) => (
          <TextField
            label={`${t('onboarding.bio')} (${t('common.optional')})`}
            value={field.value}
            onChangeText={field.onChange}
            placeholder={t('onboarding.bioPlaceholder')}
            multiline
            maxLength={280}
            hint={`${field.value?.length ?? 0}/280`}
            error={fieldError('bio')}
          />
        )}
      />
      {needsTerms ? (
        <View style={styles.gapSm}>
          <Checkbox
            checked={acceptTerms}
            onChange={(v) => {
              setAcceptTerms(v);
              setTermsError(false);
            }}
            accessibilityLabel={t('validation.acceptTerms')}
          >
            <TermsText />
          </Checkbox>
          {termsError ? (
            <Text variant="small" tone="danger">
              {t('validation.acceptTerms')}
            </Text>
          ) : null}
        </View>
      ) : null}
      {save.error ? (
        <Text tone="danger" accessibilityLiveRegion="polite">
          {t(errorKey(save.error) as 'errors.generic')}
        </Text>
      ) : null}
      <Button title={submitLabel} onPress={() => void onSubmit()} loading={save.isPending} />
    </View>
  );
}

export function TermsText() {
  return (
    <Text variant="small" tone="muted">
      <Trans
        i18nKey="auth.acceptTerms"
        components={{
          terms: <Text variant="small" tone="accent" onPress={() => Linking.openURL(brand.termsUrl)} />,
          privacy: <Text variant="small" tone="accent" onPress={() => Linking.openURL(brand.privacyUrl)} />,
        }}
      />
    </Text>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  gapSm: { gap: spacing.xs },
});
