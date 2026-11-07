/*
 * The sign-up rules of the waitlist page: the same as launchSignupSchema in packages/domain
 * (checked by apps/mobile/src/__tests__/siteParity.test.ts on many examples).
 * Returns the i18n key of the problem, or null. Plain function: inlined in the page before landing.js.
 */
// eslint-disable-next-line no-unused-vars
function ksCheck(name, value, emailRe) {
  if (name === 'firstName' || name === 'lastName') {
    var v = String(value).trim();
    if (!v.length) return 'validation.required';
    if (v.length > 50) return 'validation.tooLong';
    return null;
  }
  if (name === 'phone') {
    var p = String(value).trim();
    var digits = p.replace(/\D/g, '').length;
    return /^\+?[0-9 ()\-.]+$/.test(p) && digits >= 9 && digits <= 15 ? null : 'validation.phone';
  }
  if (name === 'email') return new RegExp(emailRe).test(String(value).trim().toLowerCase()) ? null : 'validation.email';
  if (name === 'consent') return value === true ? null : 'validation.consent';
  return null;
}
