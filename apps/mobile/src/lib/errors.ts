/**
 * Maps backend errors to i18n keys under "errors.*".
 * Supabase Auth returns stable `code` values; Edge Functions return { error: code }.
 */
const KNOWN = new Set([
  'invalid_credentials',
  'email_not_confirmed',
  'user_already_exists',
  'email_exists',
  'weak_password',
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'same_password',
  'under_min_age',
  'invalid_date_of_birth',
  'unauthorized',
  'network',
]);

export function errorKey(err: unknown): string {
  if (!err) return 'errors.generic';
  const e = err as { code?: string; message?: string; name?: string; status?: number };
  if (e.code && KNOWN.has(e.code)) return `errors.${e.code}`;
  if (e.message && KNOWN.has(e.message)) return `errors.${e.message}`;
  if (e.message?.includes('under_min_age')) return 'errors.under_min_age';
  if (e.name === 'AuthRetryableFetchError' || e.message === 'Network request failed') return 'errors.network';
  return 'errors.generic';
}
