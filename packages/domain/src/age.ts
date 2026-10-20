/**
 * Age rules. Dates of birth are stored as calendar dates (YYYY-MM-DD, no time zone),
 * so age is computed from calendar parts only — never from timestamps.
 */

export const DEFAULT_MIN_AGE = 16;

/** Returns today's calendar date (YYYY-MM-DD) in the given IANA time zone. */
export function todayInZone(now: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Parses a strict YYYY-MM-DD string into its parts, or null if it is not a real date. */
export function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

/** Full years between a date of birth and a reference calendar date (both YYYY-MM-DD). */
export function ageOn(dateOfBirth: string, onDate: string): number {
  const dob = parseIsoDate(dateOfBirth);
  const ref = parseIsoDate(onDate);
  if (!dob || !ref) throw new Error('Invalid date');
  let age = ref.y - dob.y;
  if (ref.m < dob.m || (ref.m === dob.m && ref.d < dob.d)) age -= 1;
  return age;
}

export function isOldEnough(
  dateOfBirth: string,
  minAge: number,
  now: Date = new Date(),
  timeZone = 'Europe/Bucharest',
): boolean {
  return ageOn(dateOfBirth, todayInZone(now, timeZone)) >= minAge;
}
