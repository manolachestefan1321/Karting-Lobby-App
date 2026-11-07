/**
 * The website's waitlist page (site/, built by scripts/build-site.ts) is a separate, lightweight
 * copy of src/app/join.tsx. These tests keep the two from drifting apart:
 *  - the form accepts and rejects exactly what the app's launchSignupSchema does;
 *  - every page of the app is still served by the app on the website (site/app-routes.ts).
 */
import { describe, expect, it } from '@jest/globals';
import { launchSignupSchema } from '@kartup/domain';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { regexes } from 'zod';
import { APP_ROUTES } from '../../../../site/app-routes';

const ksCheck = new Function(`${readFileSync(join(__dirname, '../../../../site/validate.js'), 'utf8')}; return ksCheck;`)() as (
  name: string,
  value: unknown,
  emailRe: string,
) => string | null;

const appError = (field: string, value: unknown) => {
  const valid = { firstName: 'Ana', lastName: 'Pop', phone: '0722 123 456', email: 'ana@email.ro', consent: true };
  const r = launchSignupSchema.safeParse({ ...valid, [field]: value });
  return r.success ? null : (r.error.issues.find((i) => i.path[0] === field)?.message ?? null);
};

const CASES: Record<string, unknown[]> = {
  firstName: ['', ' ', 'Ana', '  Ana  ', 'A'.repeat(50), 'A'.repeat(51), ` ${'B'.repeat(50)} `, 'Ștefan', 'Jean-Luc'],
  lastName: ['', 'Pop', 'P'.repeat(51), '\tPop\n'],
  phone: ['', '0722 123 456', '+40722123456', '+40 (722) 123-456', '0722.123.456', '12345678', '123456789', '1234567890123456', '+4072212345a', '0722 123 456 ', '++40722123456', '(0722) 123 456'],
  email: ['', 'ana@email.ro', ' Ana@Email.COM ', 'a@b', 'a@b.c', 'a.b@c.io', 'a..b@c.io', '.a@c.io', 'a@-c.io', 'a+b@c.co.uk', "o'neil@x.ie", 'a b@c.io', 'ana@email.r0'],
  consent: [true, false, undefined],
};

describe('website waitlist page', () => {
  for (const [field, values] of Object.entries(CASES)) {
    it(`checks ${field} exactly like the app`, () => {
      for (const v of values) expect([field, v, ksCheck(field, v ?? false, regexes.email.source)]).toEqual([field, v, appError(field, v)]);
    });
  }

  it('sends every page of the app to the app (app.html)', () => {
    const appDir = join(__dirname, '../app');
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))));
    walk(appDir);
    const paths = files
      .map((f) => relative(appDir, f).replace(/\.tsx$/, ''))
      .filter((f) => !f.split('/').pop()!.startsWith('_'))
      .map((f) => `/${f}`.replace(/\/\([^)]+\)/g, '').replace(/\/index$/, '') || '/')
      .filter((p) => p !== '/' && p !== '/join'); // the waitlist page itself
    const covered = (p: string) => APP_ROUTES.some((r) => (r.endsWith('/*') ? p.startsWith(r.slice(0, -1)) : p === r));
    expect(paths.filter((p) => !covered(p))).toEqual([]);
  });
});
