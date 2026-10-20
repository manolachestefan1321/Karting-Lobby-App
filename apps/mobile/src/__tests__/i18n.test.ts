import { describe, expect, it } from '@jest/globals';
import en from '@/i18n/en';
import ro from '@/i18n/ro';

function leafKeys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : leafKeys(v as object, `${prefix}${k}.`),
  );
}

function placeholders(s: string): string[] {
  return [...s.matchAll(/{{\s*(\w+)\s*}}|<(\w+)>/g)].map((m) => m[1] ?? m[2]!).sort();
}

describe('translations', () => {
  const enKeys = leafKeys(en);
  const roKeys = leafKeys(ro);

  it('Romanian has exactly the same keys as English', () => {
    expect(roKeys.sort()).toEqual(enKeys.sort());
  });

  it('every Romanian string uses the same {{placeholders}} and <tags> as English', () => {
    const get = (o: object, path: string) => path.split('.').reduce<any>((acc, k) => acc[k], o) as string;
    for (const key of enKeys) {
      expect([key, placeholders(get(ro, key))]).toEqual([key, placeholders(get(en, key))]);
    }
  });

  it('has no empty strings', () => {
    for (const key of roKeys) {
      const value = key.split('.').reduce<any>((acc, k) => acc[k], ro) as string;
      expect(value.trim()).not.toBe('');
    }
  });
});
