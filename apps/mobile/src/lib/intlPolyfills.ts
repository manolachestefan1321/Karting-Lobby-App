/**
 * Hermes (the JavaScript engine on iPhone/Android) doesn't have every Intl API the
 * browser has: Intl.RelativeTimeFormat ("in 3 hours") and Intl.PluralRules (needed
 * by i18next for "1 session / 3 sessions", incl. Romanian "few"). These polyfills
 * only install themselves when the API is missing, so the web is unaffected.
 * Loaded first, from index.ts.
 */
import '@formatjs/intl-getcanonicallocales/polyfill.js';
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/ro.js';
import '@formatjs/intl-relativetimeformat/polyfill.js';
import '@formatjs/intl-relativetimeformat/locale-data/en.js';
import '@formatjs/intl-relativetimeformat/locale-data/ro.js';
