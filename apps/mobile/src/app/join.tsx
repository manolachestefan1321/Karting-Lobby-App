import { launchSignupSchema } from '@kartup/domain';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Text, TextField } from '@/components/ui';
import { useGoToApp } from '@/components/brand/WebNav';
import { api } from '@/data';
import { openCookieSettings } from '@/features/web/consent';
import { usePageMeta } from '@/features/web/seo';
import { useSiteMotion } from '@/features/web/motion';
import { errorKey } from '@/lib/errors';
import { zodResolver } from '@/lib/zodResolver';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/tokens';

const CARDS = ['first', 'priority', 'history'] as const;
const FLOW = ['heats', 'final', 'podium'] as const;

/**
 * "JOIN THE RACE" (website menu, before launch): the launch event is coming,
 * sign up to be among the first. No account needed; only admins can read the list.
 * Colors come from the app theme (light and dark).
 */
export default function JoinTheRace() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const locale = usePreferences((s) => s.locale) ?? 'ro';
  const scroll = useRef<ScrollView>(null);
  const formY = useRef(0);
  const scrollTo = useSiteMotion(scroll);
  const goToApp = useGoToApp();
  usePageMeta(t('seo.title'), t('seo.description'));
  const [done, setDone] = useState<'created' | 'exists' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const { control, handleSubmit, formState, reset } = useForm({
    resolver: zodResolver(launchSignupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      consent: false as unknown as true,
    },
  });
  const msg = (m?: string) => (m ? t(m as 'validation.required') : undefined);

  const onSubmit = handleSubmit(async ({ firstName, lastName, phone, email }) => {
    setError(null);
    try {
      setDone(
        await api.launch.signup({
          firstName,
          lastName,
          phone,
          email,
          locale,
        }),
      );
      reset();
    } catch (err) {
      setError(t(errorKey(err) as 'errors.generic'));
    }
  });

  const big = wide ? 96 : 52;
  const display = (size: number) => ({
    fontFamily: fonts.wordmark,
    fontSize: size,
    lineHeight: size * 1.02,
    color: colors.text,
  });
  const section = [styles.section, { borderTopColor: colors.border }];

  return (
    <ScrollView ref={scroll} style={{ backgroundColor: colors.background }} keyboardShouldPersistTaps="handled">
      {/* ── Hero ───────────────────────────── */}
      <View style={styles.wrap}>
        <View nativeID="hero-badges" style={styles.badges}>
          <View style={[styles.badge, { borderColor: colors.accent }]}>
            <Text variant="caption" tone="accent" style={styles.tracked}>
              {t('join.badge')}
            </Text>
          </View>
          <Text variant="caption" tone="muted" style={styles.tracked}>
            {t('join.badgeNote')}
          </Text>
        </View>
        <Text nativeID="hero-headline" style={display(big)}>
          {t('join.headline1')}
          {'\n'}
          {t('join.headline2')}
          <Text style={[display(big), { color: colors.accent }]}>{t('join.headlineAccent')}</Text>
        </Text>
        <Text nativeID="hero-body" style={styles.lead}>
          {t('join.body')}
        </Text>
        <Text nativeID="hero-tagline" style={display(wide ? 26 : 22)}>
          {t('join.tagline')}
        </Text>
        <View nativeID="hero-cta" style={styles.ctaRow}>
          <Button title={t('join.cta')} fullWidth={false} onPress={() => scrollTo(formY.current)} />
        </View>
      </View>

      {/* ── Why the waitlist wins ─────────────── */}
      <View style={section}>
        <View style={styles.wrap}>
          <Text nativeID="reveal-why" style={display(wide ? 52 : 36)}>
            {t('join.whyTitle')}
          </Text>
          <View style={styles.cards}>
            {CARDS.map((c) => (
              <View
                key={c}
                nativeID={`reveal-card-${c}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text variant="caption" tone="accent" style={styles.tracked}>
                  {t(`join.cards.${c}.kicker`)}
                </Text>
                <Text variant="heading" style={styles.cardTitle}>
                  {t(`join.cards.${c}.title`)}
                </Text>
                <Text tone="muted">{t(`join.cards.${c}.body`)}</Text>
              </View>
            ))}
          </View>
          <View nativeID="reveal-flow" style={styles.flow}>
            {FLOW.map((f, i) => (
              <Fragment key={f}>
                {i > 0 ? <Ionicons name="arrow-forward" size={20} color={colors.accent} /> : null}
                <View
                  style={[
                    styles.step,
                    f === 'podium'
                      ? {
                          backgroundColor: colors.accent,
                          borderColor: colors.accent,
                        }
                      : {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                  ]}
                >
                  <Text style={[styles.stepText, { color: f === 'podium' ? colors.onAccent : colors.text }]}>{t(`join.flow.${f}`)}</Text>
                </View>
              </Fragment>
            ))}
          </View>
        </View>
      </View>

      {/* ── Lock in your spot (form) ──────────── */}
      <View style={section} onLayout={(e) => (formY.current = e.nativeEvent.layout.y)}>
        <View style={[styles.wrap, wide && styles.split]}>
          <View nativeID="reveal-form-intro" style={[styles.gapMd, wide && styles.flex]}>
            <Text style={display(wide ? 72 : 48)}>
              {t('join.formTitle1')}
              {'\n'}
              {t('join.formTitle2')}
              <Text style={[display(wide ? 72 : 48), { color: colors.accent }]}>{t('join.formTitleAccent')}</Text>
            </Text>
            <Text style={styles.lead}>{t('join.formBody')}</Text>
          </View>

          <View nativeID="reveal-form" style={[styles.form, wide && styles.flex, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {done ? (
              <View style={styles.gapMd}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                <Text variant="heading">{done === 'created' ? t('join.doneTitle') : t('join.existsTitle')}</Text>
                <Text tone="muted">{done === 'created' ? t('join.doneBody') : t('join.existsBody')}</Text>
                <Button title={t('join.another')} variant="secondary" onPress={() => setDone(null)} />
              </View>
            ) : (
              <>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Controller
                      control={control}
                      name="firstName"
                      render={({ field }) => (
                        <TextField
                          label={t('join.firstName')}
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          autoComplete="given-name"
                          textContentType="givenName"
                          returnKeyType="next"
                          onSubmitEditing={() => lastRef.current?.focus()}
                          error={msg(formState.errors.firstName?.message)}
                        />
                      )}
                    />
                  </View>
                  <View style={styles.half}>
                    <Controller
                      control={control}
                      name="lastName"
                      render={({ field }) => (
                        <TextField
                          ref={lastRef}
                          label={t('join.lastName')}
                          value={field.value}
                          onChangeText={field.onChange}
                          onBlur={field.onBlur}
                          autoComplete="family-name"
                          textContentType="familyName"
                          returnKeyType="next"
                          onSubmitEditing={() => phoneRef.current?.focus()}
                          error={msg(formState.errors.lastName?.message)}
                        />
                      )}
                    />
                  </View>
                </View>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <TextField
                      ref={phoneRef}
                      label={t('join.phone')}
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="+40 7xx xxx xxx"
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                      error={msg(formState.errors.phone?.message)}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="email"
                  render={({ field }) => (
                    <TextField
                      ref={emailRef}
                      label={t('join.email')}
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="you@email.com"
                      autoCapitalize="none"
                      autoComplete="email"
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      returnKeyType="done"
                      onSubmitEditing={() => void onSubmit()}
                      error={msg(formState.errors.email?.message)}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="consent"
                  render={({ field }) => (
                    <View style={styles.gapXs}>
                      <Checkbox checked={!!field.value} onChange={field.onChange} accessibilityLabel={t('join.consent')}>
                        <Text variant="small" tone="muted">
                          {t('join.consent')}
                        </Text>
                      </Checkbox>
                      {formState.errors.consent ? (
                        <Text variant="small" tone="danger">
                          {t('validation.consent')}
                        </Text>
                      ) : null}
                    </View>
                  )}
                />
                {error ? (
                  <Text tone="danger" accessibilityLiveRegion="polite">
                    {error}
                  </Text>
                ) : null}
                <Button title={t('join.submit')} onPress={() => void onSubmit()} loading={formState.isSubmitting} />
              </>
            )}
          </View>
        </View>
      </View>

      {/* ── Disclaimer + footer ───────────────── */}
      <View style={section}>
        <View style={[styles.wrap, styles.gapMd]}>
          <Text variant="caption" tone="muted" style={styles.disclaimer}>
            <Text variant="caption" style={styles.bold}>
              {t('join.disclaimerLabel')}
            </Text>{' '}
            {t('join.disclaimer')}
          </Text>
          <View style={styles.footer}>
            <Text variant="caption" tone="muted">
              {t('join.copyright', { year: new Date().getFullYear() })}
            </Text>
            <View style={styles.footerLinks}>
              <Pressable onPress={() => router.push('/legal/privacy')} accessibilityRole="link">
                <Text variant="caption" style={styles.underline}>
                  {t('cookies.privacyLink')}
                </Text>
              </Pressable>
              {Platform.OS === 'web' ? (
                <Pressable onPress={openCookieSettings} accessibilityRole="button">
                  <Text variant="caption" style={styles.underline}>
                    {t('cookies.settingsLink')}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={goToApp} accessibilityRole="link">
                <Text variant="caption" style={styles.underline}>
                  {t('join.backHome')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: 1160,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    gap: spacing.lg,
  },
  section: { borderTopWidth: StyleSheet.hairlineWidth },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  tracked: { letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700' },
  lead: { fontSize: 18, lineHeight: 28, maxWidth: 600 },
  ctaRow: { flexDirection: 'row' },
  // 3 cards per row on wide screens, 2 on tablets, 1 on phones.
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexGrow: 1,
    flexBasis: 300,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: 24,
    lineHeight: 28,
    textTransform: 'uppercase',
  },
  flow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  step: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepText: { fontFamily: fonts.wordmark, fontSize: 20, lineHeight: 24 },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xxl },
  form: {
    borderWidth: 1,
    borderRadius: 10,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  half: { flex: 1, minWidth: 160 },
  flex: { flex: 1 },
  gapMd: { gap: spacing.md },
  gapXs: { gap: spacing.xs },
  disclaimer: { maxWidth: 820, lineHeight: 19 },
  bold: { fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  underline: { textDecorationLine: 'underline' },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
