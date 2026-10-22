import { formatMoney } from '@kartup/domain';

/**
 * Date/time formatting. Session times are ALWAYS shown in the track's local time
 * (owner decision), regardless of the phone's time zone.
 */
export function formatTime(iso: string | Date, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(iso));
}

export function formatDay(iso: string | Date, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone }).format(new Date(iso));
}

export function formatDateTime(iso: string | Date, timeZone: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(iso));
}

export function formatDate(iso: string | Date, locale: string, timeZone = 'Europe/Bucharest') {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(new Date(iso));
}

/** "YYYY-MM-DD" of an instant in a time zone. */
export function localDateKey(iso: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(iso));
}

/** Short relative label: "in 2 h 5 min", "5 min ago". */
/**
 * The next `count` calendar days in `timeZone`, starting today, as "YYYY-MM-DD" keys
 * plus noon of each day (safe to format). Steps by calendar day, not by 24 hours:
 * on daylight-saving days (23 or 25 hours long) adding 24 h can skip or repeat a day.
 */
export function nextDays(now: Date, timeZone: string, count: number): { key: string; noon: Date }[] {
  const [y, m, d] = localDateKey(now, timeZone).split('-').map(Number) as [number, number, number];
  return Array.from({ length: count }, (_, i) => {
    const key = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    return { key, noon: zonedToUtc(key, '12:00', timeZone) };
  });
}

export function relative(target: Date | string, now: Date, locale: string) {
  const diff = new Date(target).getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const abs = Math.abs(diff);
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), 'second');
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  return rtf.format(Math.round(diff / 86_400_000), 'day');
}

/** Countdown "01:23:45" or "2d 03:04:05". */
export function countdown(target: Date | string, now: Date) {
  let s = Math.max(0, Math.floor((new Date(target).getTime() - now.getTime()) / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hms = [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
  return d > 0 ? `${d}d ${hms}` : hms;
}

export function money(minor: number, currency: string, locale: string) {
  return formatMoney(minor, currency, locale);
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffset(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - instant;
}

/** "2026-10-24" + "19:30" at the track (e.g. Europe/Bucharest) → UTC instant. DST-safe. */
export function zonedToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let guess = naive - tzOffset(naive, timeZone);
  guess = naive - tzOffset(guess, timeZone);
  return new Date(guess);
}
