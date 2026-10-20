import { describe, expect, it } from 'vitest';
import { profileSchema, signUpSchema, trackExperienceSchema } from '../src/profile.ts';

const now = new Date('2026-10-20T12:00:00Z');
const cityId = '7d6c3f8e-5a1b-4c2d-9e8f-0a1b2c3d4e5f';

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error!.issues[0]!.message;
}

describe('sign up', () => {
  it('requires accepting the terms', () => {
    const r = signUpSchema.safeParse({ email: 'a@b.ro', password: 'abcdefg1', acceptTerms: false });
    expect(firstError(r)).toBe('validation.acceptTerms');
  });

  it('requires a strong-enough password', () => {
    expect(firstError(signUpSchema.safeParse({ email: 'a@b.ro', password: 'short1', acceptTerms: true }))).toBe(
      'validation.passwordLength',
    );
    expect(firstError(signUpSchema.safeParse({ email: 'a@b.ro', password: 'abcdefgh', acceptTerms: true }))).toBe(
      'validation.passwordDigit',
    );
  });

  it('normalises email', () => {
    const r = signUpSchema.parse({ email: '  Ana@Example.RO ', password: 'abcdefg1', acceptTerms: true });
    expect(r.email).toBe('ana@example.ro');
  });
});

describe('profile', () => {
  const base = { firstName: 'Ana', lastName: 'Pop', homeCityId: cityId, bio: '' };

  it('enforces the configurable minimum age', () => {
    expect(profileSchema(16, now).safeParse({ ...base, dateOfBirth: '2010-10-20' }).success).toBe(true);
    expect(firstError(profileSchema(16, now).safeParse({ ...base, dateOfBirth: '2010-10-21' }))).toBe(
      'validation.minAge',
    );
    expect(profileSchema(18, now).safeParse({ ...base, dateOfBirth: '2010-10-20' }).success).toBe(false);
  });

  it('rejects invalid dates and long bios', () => {
    expect(firstError(profileSchema(16, now).safeParse({ ...base, dateOfBirth: '2001-02-30' }))).toBe(
      'validation.date',
    );
    expect(
      firstError(profileSchema(16, now).safeParse({ ...base, dateOfBirth: '2000-01-01', bio: 'x'.repeat(281) })),
    ).toBe('validation.tooLong');
  });
});

describe('track experience', () => {
  it('accepts an optional best lap', () => {
    expect(
      trackExperienceSchema.safeParse({ trackId: cityId, level: 'beginner', bestLapMs: null, sessionsCount: 0 })
        .success,
    ).toBe(true);
    expect(
      trackExperienceSchema.safeParse({ trackId: cityId, level: 'pro', bestLapMs: null, sessionsCount: 0 }).success,
    ).toBe(false);
  });
});
