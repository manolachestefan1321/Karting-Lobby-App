import { launchSignupSchema } from '@kartup/domain';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Text, TextField } from '@/components/ui';
import { brand } from '@config/brand';
import { useGoToApp } from '@/components/brand/WebNav';
import { api, DATA_SOURCE } from '@/data';
import { RANK_TIERS } from '@/data/ranks';
import { SiteStyles, SpeedLines, TrackLine } from '@/features/web/site/SiteDecor';
import { openCookieSettings } from '@/features/web/consent';
import { usePageMeta } from '@/features/web/seo';
import { useSiteMotion } from '@/features/web/motion';
import { removeInstantShell, takeFormIntent } from '@/features/web/shell';
import { errorKey } from '@/lib/errors';
import { zodResolver } from '@/lib/zodResolver';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, spacing } from '@/theme/tokens';

const CARDS = ['first', 'priority', 'history'] as const;
const FLOW = ['heats', 'final', 'podium'] as const;
const STEPS = ['city', 'lobby', 'race'] as const;

/**
 * PLACEHOLDER: the waitlist has no public count yet (visitors can't read launch_signups, on purpose).
 * Wire it later to a count-only database function and put the real number here.
 * null hides the counter, so the real site never shows an invented number.
 */
const WAITLIST_COUNT: number | null = DATA_SOURCE === 'mock' ? 1248 : null;

/** Splits a line into words the hero animation can move one by one (ids hw-N). */
/** Each word gets the full headline style: the shared Text applies body text styles otherwise. */
function words(text: string, start: number, style: object) {
  return text
    .split(' ')
    .filter(Boolean)
    .flatMap((w, i) => [
      <Text key={`w${start + i}`} nativeID={`hw-${start + i}`} style={style}>
        {w}
      </Text>,
      ' ',
    ]);
}

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
  // The real page is on screen: swap out the instant first view (before the animations start).
  // Read the tap before removing the first view: a "Lock in my spot" tap made while loading counts.
  const goToForm = useRef(false);
  useLayoutEffect(() => {
    goToForm.current = takeFormIntent();
    removeInstantShell();
  }, []);
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
  const stepsRow = width >= 768;
  const h1 = t('join.headline1').split(' ').filter(Boolean).length;
  const h2 = t('join.headline2').split(' ').filter(Boolean).length;
  const display = (size: number) => ({
    fontFamily: fonts.wordmark,
    fontSize: size,
    lineHeight: size * 1.02,
    color: colors.text,
  });
  const section = [styles.section, { borderTopColor: colors.border }];

  return (
    <ScrollView ref={scroll} nativeID="join-page" style={{ backgroundColor: colors.background }} keyboardShouldPersistTaps="handled">
      <SiteStyles accent={colors.accent} line={colors.border} />
      {/* ── Hero ───────────────────────────── */}
      <View nativeID="hero" style={styles.hero}>
        {/*
          VIDEO PLACEHOLDER: when there is footage, put a muted, looping, playsInline background
          video here (absolute, full size, object-fit cover, behind the content, with a dark
          overlay for contrast), e.g. <video src="/hero-loop.mp4" autoPlay muted loop playsInline poster="/hero-poster.jpg" />
          in a web-only component like SpeedLines. Keep it under ~2 MB and load it after the page is
          interactive. The speed lines can stay on top of it or be removed.
        */}
        <SpeedLines />
        <View style={styles.wrap}>
          <Text nativeID="hero-slogan" style={[display(wide ? 28 : 22), { color: colors.accent }]}>
            {brand.slogan.toUpperCase()}
          </Text>
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
          <Text nativeID="headline" accessibilityRole="header" style={display(big)}>
            {words(t('join.headline1'), 0, display(big))}
            {'\n'}
            {words(t('join.headline2'), h1, display(big))}
            {words(t('join.headlineAccent'), h1 + h2, [display(big), { color: colors.accent }])}
          </Text>
          <Text nativeID="hero-body" style={styles.lead}>
            {t('join.body')}
          </Text>
          <Text nativeID="hero-tagline" style={display(wide ? 26 : 22)}>
            {t('join.tagline')}
          </Text>
          {/* Never animated or delayed: usable from the first frame. */}
          <View nativeID="btn-hero" style={styles.ctaRow}>
            <Button title={t('join.cta')} fullWidth={false} onPress={() => scrollTo(formY.current)} />
          </View>
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
              <View key={c} nativeID={`reveal-card-${c}`} style={styles.cardSlot}>
                <View
                  nativeID={`hc-card-${c}`}
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

      {/* ── How it works ──────────────────────── */}
      <View style={section}>
        <View style={styles.wrap}>
          <View nativeID="reveal-how" style={styles.gapXs}>
            <Text variant="caption" tone="accent" style={styles.tracked}>
              {t('join.how.kicker')}
            </Text>
            <Text style={display(wide ? 52 : 36)}>{t('join.how.title')}</Text>
          </View>
          <View nativeID="how-steps" style={stepsRow ? styles.stepsRow : styles.stepsCol}>
            <TrackLine vertical={!stepsRow} />
            {STEPS.map((s, i) => (
              <View key={s} nativeID={`step-${i}`} style={stepsRow ? styles.stepWide : styles.stepNarrow}>
                <View style={[styles.stepBadge, stepsRow ? styles.stepBadgeWide : null, { borderColor: colors.accent, backgroundColor: colors.background }]}>
                  <Text style={[styles.stepNum, { color: colors.accent }]}>{i + 1}</Text>
                </View>
                <View style={[styles.stepBody, stepsRow && styles.center]}>
                  <Text variant="heading" style={[styles.cardTitle, stepsRow && styles.textCenter]}>
                    {t(`join.how.${s}.title`)}
                  </Text>
                  <Text tone="muted" style={stepsRow ? styles.textCenter : undefined}>
                    {t(`join.how.${s}.body`)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Ranks (the highlight) ─────────────── */}
      <View style={section}>
        <View style={styles.wrap}>
          <View nativeID="reveal-ranks" style={styles.gapSm}>
            <Text variant="caption" tone="accent" style={styles.tracked}>
              {t('join.ranks.kicker')}
            </Text>
            <Text style={display(wide ? 52 : 36)}>{t('join.ranks.title')}</Text>
            <Text style={styles.lead}>{t('join.ranks.body')}</Text>
          </View>
          <View nativeID="ranks-grid" style={styles.gapMd}>
            <View style={[styles.rankBar, { backgroundColor: colors.surfaceAlt }]}>
              <View nativeID="rank-fill" style={[styles.rankFill, { backgroundColor: colors.accent }]} />
            </View>
            <View style={styles.rankGrid}>
              {RANK_TIERS.map((r, i) => {
                const top = i === RANK_TIERS.length - 1;
                return (
                  <View key={r.key} nativeID={`rcard-${i}`} style={[styles.rankSlot, { flexBasis: wide ? 240 : 150 }]}>
                    <View
                      nativeID={`hc-rank-${i}`}
                      style={[styles.rankCard, { backgroundColor: colors.surface, borderColor: top ? colors.accent : colors.border }, top && styles.rankTop]}
                    >
                      <View style={[styles.rankStripe, { backgroundColor: r.color }]} />
                      <Text variant="caption" tone="muted" style={styles.tracked}>
                        {top ? t('join.ranks.top') : String(i + 1).padStart(2, '0')}
                      </Text>
                      <Text style={[display(wide ? 30 : 24), top && { color: colors.accent }]}>{r.name.toUpperCase()}</Text>
                      <Text variant="caption" tone="muted">
                        {t('join.ranks.km', { km: r.minKm.toLocaleString('en-US') })} · {t('join.ranks.xp', { xp: r.minXp.toLocaleString('en-US') })}
                      </Text>
                      <View nativeID={`rlock-${i}`} style={styles.rankLock} accessibilityLabel={t('join.ranks.locked')}>
                        <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>

      {/* ── Waitlist counter (hidden until there is a real number, see WAITLIST_COUNT) ── */}
      {WAITLIST_COUNT !== null ? (
        <View style={section}>
          <View nativeID="reveal-counter" style={[styles.wrap, styles.counter]}>
            <Text nativeID="count-waitlist" style={[display(wide ? 120 : 72), { color: colors.accent }]}>
              {WAITLIST_COUNT.toLocaleString('en-US')}
            </Text>
            <Text style={[styles.lead, styles.textCenter]}>{t('join.counter.label')}</Text>
          </View>
        </View>
      ) : null}

      {/* ── Lock in your spot (form) ──────────── */}
      <View
        style={section}
        onLayout={(e) => {
          formY.current = e.nativeEvent.layout.y;
          if (goToForm.current) {
            goToForm.current = false;
            scrollTo(formY.current);
          }
        }}
      >
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
                <View nativeID="btn-submit">
                  <Button title={t('join.submit')} onPress={() => void onSubmit()} loading={formState.isSubmitting} />
                </View>
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
  hero: { position: 'relative', overflow: 'hidden' },
  cardSlot: { flexGrow: 1, flexBasis: 300 },
  // How it works: a row of 3 on tablets/desktop (line across the badges), a column on phones (line down the left).
  stepsRow: { position: 'relative', flexDirection: 'row' },
  stepsCol: { position: 'relative', gap: spacing.xl },
  stepWide: { flex: 1, alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  stepNarrow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  stepBadge: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  stepBadgeWide: { width: 56, height: 56, borderRadius: 28, marginTop: 4 },
  stepNum: { fontFamily: fonts.wordmark, fontSize: 24, lineHeight: 28 },
  stepBody: { flex: 1, gap: spacing.xs, paddingTop: spacing.xs },
  center: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },
  gapSm: { gap: spacing.sm },
  rankBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  rankFill: { width: '100%', height: '100%' },
  rankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  rankSlot: { flexGrow: 1 },
  rankCard: { borderWidth: 1, borderRadius: 8, padding: spacing.md, paddingTop: spacing.lg, gap: spacing.xs, overflow: 'hidden', minHeight: 124 },
  rankTop: { borderWidth: 2 },
  rankStripe: { position: 'absolute', left: 0, right: 0, top: 0, height: 4 },
  rankLock: { position: 'absolute', top: spacing.md, right: spacing.md },
  counter: { alignItems: 'center', gap: spacing.xs },
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
