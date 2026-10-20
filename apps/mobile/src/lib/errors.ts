import { ApiError } from '@/data';
import en from '@/i18n/en';

/**
 * Maps any backend error to an i18n key under "errors.*" plus interpolation params.
 * Both backends throw ApiError with a stable `code`.
 */
export function errorKey(err: unknown): string {
  return describeError(err).key;
}

export function describeError(err: unknown): { key: string; params: Record<string, string | number> } {
  if (!err) return { key: 'errors.generic', params: {} };
  const e = err as { code?: string; message?: string; name?: string; params?: Record<string, string | number> };
  const known = (code?: string) => !!code && code in en.errors;
  if (err instanceof ApiError && known(err.code)) return { key: `errors.${err.code}`, params: err.params };
  if (known(e.code)) return { key: `errors.${e.code}`, params: e.params ?? {} };
  if (known(e.message)) return { key: `errors.${e.message}`, params: {} };
  if (e.message?.includes('under_min_age')) return { key: 'errors.under_min_age', params: {} };
  if (e.name === 'AuthRetryableFetchError' || e.message === 'Network request failed') return { key: 'errors.network', params: {} };
  return { key: 'errors.generic', params: {} };
}

/** Translated, human-readable error text (formats dates like the ban end time). */
export function errorText(err: unknown, t: (key: never, params?: Record<string, unknown>) => string, locale: string): string {
  const { key, params } = describeError(err);
  const p: Record<string, unknown> = { ...params };
  if (typeof p.until === 'string' && p.until) {
    p.until = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Bucharest' }).format(new Date(p.until));
  }
  return t(key as never, p);
}
