import { z } from 'zod';
import { DEFAULT_MIN_AGE, isOldEnough, parseIsoDate } from './age.ts';

/**
 * Validation schemas shared by the app (forms) and the server.
 * Error messages are i18n KEYS (e.g. "validation.required"), translated by the app.
 */

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const NAME_MAX = 50;
export const BIO_MAX = 280;

const name = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .max(NAME_MAX, 'validation.tooLong');

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('validation.email'));

/** Supabase default minimum is 6; we require 8 with a letter and a digit. */
export const passwordSchema = z
  .string()
  .min(8, 'validation.passwordLength')
  .regex(/[A-Za-z]/, 'validation.passwordLetter')
  .regex(/\d/, 'validation.passwordDigit');

export function dateOfBirthSchema(minAge: number = DEFAULT_MIN_AGE, now?: Date) {
  return z
    .string()
    .refine((v) => parseIsoDate(v) !== null, 'validation.date')
    .refine((v) => parseIsoDate(v) === null || parseIsoDate(v)!.y >= 1900, 'validation.date')
    .refine((v) => parseIsoDate(v) === null || isOldEnough(v, minAge, now), 'validation.minAge');
}

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'validation.required'),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, 'validation.acceptTerms'),
});

export function profileSchema(minAge: number = DEFAULT_MIN_AGE, now?: Date) {
  return z.object({
    firstName: name,
    lastName: name,
    dateOfBirth: dateOfBirthSchema(minAge, now),
    homeCityId: z.string().min(1, 'validation.required'),
    bio: z.string().trim().max(BIO_MAX, 'validation.tooLong').default(''),
  });
}

export const trackExperienceSchema = z.object({
  trackId: z.string().min(1, 'validation.required'),
  level: z.enum(EXPERIENCE_LEVELS),
  bestLapMs: z.number().int().min(5000).max(600000).nullable(),
  sessionsCount: z.number().int().min(0).max(10000),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ProfileInput = z.infer<ReturnType<typeof profileSchema>>;
export type TrackExperienceInput = z.infer<typeof trackExperienceSchema>;
