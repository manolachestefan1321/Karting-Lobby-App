import { describe, expect, it } from '@jest/globals';
import en from '@/i18n/en';
import { errorKey } from '@/lib/errors';

describe('errorKey', () => {
  it('maps Supabase auth error codes to translated keys', () => {
    expect(errorKey({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('errors.invalid_credentials');
    expect(errorKey({ code: 'email_not_confirmed' })).toBe('errors.email_not_confirmed');
  });

  it('maps database age-check errors', () => {
    expect(errorKey({ message: 'under_min_age' })).toBe('errors.under_min_age');
    expect(errorKey({ code: 'P0001', message: 'ERROR: under_min_age' })).toBe('errors.under_min_age');
  });

  it('falls back to a generic message', () => {
    expect(errorKey(new Error('boom'))).toBe('errors.generic');
    expect(errorKey(null)).toBe('errors.generic');
  });

  it('only returns keys that exist in the translations', () => {
    const samples = ['invalid_credentials', 'weak_password', 'network', 'unauthorized'].map((code) => errorKey({ code }));
    for (const key of samples) {
      const [, sub] = key.split('.');
      expect(en.errors).toHaveProperty(sub!);
    }
  });
});
