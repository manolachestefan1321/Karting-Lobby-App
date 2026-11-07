/*
 * KartUP waitlist page: everything that must work straight away (no libraries).
 *  - language + light/dark (same saved preferences as the app: localStorage "kartup-preferences")
 *  - the sign-up form (same rules as launchSignupSchema in packages/domain, same table as the app)
 *  - cookie banner and consent (same rules, storage and records as src/features/web/consent.ts)
 *  - anonymous statistics only after consent (same as src/features/web/SiteTracker.web.tsx)
 * Settings come from the page: window.KS = { url, key, consentVersion, emailRe, dict }.
 */
(function () {
  'use strict';
  var KS = window.KS;
  var doc = document.documentElement;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ── Preferences (shared with the app) ─────────────────────────────────────
  var PREFS = 'kartup-preferences';
  function readPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PREFS) || 'null');
      return p && p.state ? p : { state: { locale: null, theme: 'light', cityId: null }, version: 1 };
    } catch (e) {
      return { state: { locale: null, theme: 'light', cityId: null }, version: 1 };
    }
  }
  function savePref(key, value) {
    var p = readPrefs();
    p.state[key] = value;
    try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch (e) { /* storage blocked: holds for this visit */ }
  }
  function lang() { return doc.lang === 'ro' ? 'ro' : 'en'; }
  function tr(key) { return (KS.dict[lang()] || {})[key] || KS.dict.en[key] || key; }
  function both(key) {
    // Messages written by the script carry both languages, like the rest of the page.
    return '<span data-l="en">' + esc(KS.dict.en[key]) + '</span><span data-l="ro">' + esc(KS.dict.ro[key]) + '</span>';
  }
  function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function applyMeta() {
    document.title = tr('seo.title');
    var meta = $('meta[name="description"]');
    if (meta) meta.setAttribute('content', tr('seo.description'));
    var t = $('#theme-toggle');
    if (t) t.setAttribute('aria-label', doc.dataset.theme === 'dark' ? tr('settings.themeLight') : tr('settings.themeDark'));
    var l = $('#lang-toggle');
    if (l) l.setAttribute('aria-label', lang() === 'ro' ? 'English' : 'Română');
  }
  applyMeta();

  // The language button is a link to the other language's page; remember the choice for the app too.
  $('#lang-toggle').addEventListener('click', function () { savePref('locale', this.getAttribute('data-lang')); });
  $('#theme-toggle').addEventListener('click', function () {
    var next = doc.dataset.theme === 'dark' ? 'light' : 'dark';
    doc.dataset.theme = next;
    savePref('theme', next);
    applyMeta();
  });

  // Top left: "Log in / Sign up", or "Open the app" for someone already signed in on this browser.
  var signedIn = false;
  try {
    for (var i = 0; i < localStorage.length; i++) if (/^sb-.*-auth-token$/.test(localStorage.key(i) || '')) signedIn = true;
  } catch (e) { /* no storage: signed out */ }
  document.querySelectorAll('[data-auth]').forEach(function (el) { el.hidden = el.getAttribute('data-auth') !== (signedIn ? 'in' : 'out'); });

  // ── Scrolling to the form (smooth with Lenis once motion.js is loaded) ────
  function toForm(e) {
    if (e) e.preventDefault();
    var target = $('#form-section');
    if (window.__ksLenis) window.__ksLenis.scrollTo(target, { duration: 1.1 });
    else target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  $$('[data-to-form]').forEach(function (b) { b.addEventListener('click', toForm); });

  // ── Sign-up form (rules = launchSignupSchema) ─────────────────────────────
  var form = $('#signup');
  var tried = false;

  function value(name) { return form.elements[name].value; }
  // Rules in validate.js (ksCheck), the same as the app's launchSignupSchema.
  function check(name) {
    return window.ksCheck(name, name === 'consent' ? form.elements.consent.checked : value(name), KS.emailRe);
  }
  var FIELDS = ['firstName', 'lastName', 'phone', 'email', 'consent'];
  function show(name, key) {
    var box = $('[data-err="' + name + '"]');
    var field = box && box.closest('.field');
    if (field) field.classList.toggle('bad', !!key);
    if (!box) return;
    box.hidden = !key;
    box.innerHTML = key ? both(key) : '';
  }
  function validate() {
    var first = null;
    FIELDS.forEach(function (n) {
      var key = check(n);
      show(n, key);
      if (key && !first) first = n;
    });
    return first;
  }
  FIELDS.forEach(function (n) {
    var el = form.elements[n];
    el.addEventListener(n === 'consent' ? 'change' : 'input', function () { if (tried) show(n, check(n)); });
  });

  var submit = $('#submit');
  var formError = $('#form-error');
  function busy(on) {
    submit.disabled = on;
    submit.setAttribute('aria-busy', on ? 'true' : 'false');
    $('.lb', submit).hidden = on;
    $('.spin', submit).hidden = !on;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    tried = true;
    formError.hidden = true;
    var bad = validate();
    if (bad) {
      var el = form.elements[bad];
      if (el && el.focus) el.focus();
      return;
    }
    busy(true);
    fetch(KS.url + '/rest/v1/launch_signups', {
      method: 'POST',
      headers: { apikey: KS.key, Authorization: 'Bearer ' + KS.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        first_name: value('firstName').trim(),
        last_name: value('lastName').trim(),
        phone: value('phone').trim(),
        email: value('email').trim().toLowerCase(),
        locale: lang(),
      }),
    })
      .then(function (res) {
        if (res.ok) return 'created';
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (res.status === 409 || (body && body.code === '23505')) return 'exists';
          throw new Error('generic');
        });
      })
      .then(function (result) {
        busy(false);
        form.reset();
        tried = false;
        FIELDS.forEach(function (n) { show(n, null); });
        form.hidden = true;
        $('#done-created').hidden = result !== 'created';
        $('#done-exists').hidden = result !== 'exists';
        $('#done').hidden = false;
      })
      .catch(function (err) {
        busy(false);
        formError.innerHTML = both(err && err.message === 'generic' ? 'errors.generic' : 'errors.network');
        formError.hidden = false;
      });
  });
  $('#another').addEventListener('click', function () {
    $('#done').hidden = true;
    form.hidden = false;
    form.elements.firstName.focus();
  });

  // ── Cookie consent (rules = src/features/web/consent.ts) ──────────────────
  var CONSENT = 'kartup-consent';
  var MAX_AGE_MS = 182 * 24 * 3600000;
  function readChoice() {
    try {
      var c = JSON.parse(localStorage.getItem(CONSENT) || 'null');
      if (!c || c.version !== KS.consentVersion || Date.now() - new Date(c.decidedAt).getTime() > MAX_AGE_MS) return null;
      return c;
    } catch (e) {
      return null;
    }
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) | 0;
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  }
  function clearAnalyticsStorage() {
    try { localStorage.removeItem('kartup-vid'); sessionStorage.removeItem('kartup-sid'); } catch (e) { /* nothing stored either */ }
  }
  var choice = readChoice();
  var banner = $('#cookie');
  var toggle = $('#cookie-analytics');

  function render(detailed) {
    if (choice && !detailed) { banner.hidden = true; return; }
    banner.hidden = false;
    banner.classList.toggle('detailed', !!detailed);
    var card = $('.cookie-card', banner);
    if (detailed) { card.removeAttribute('role'); card.setAttribute('aria-modal', 'true'); } else { card.setAttribute('role', 'alert'); card.removeAttribute('aria-modal'); }
    $('#cookie-close').hidden = !(detailed && choice);
    toggle.checked = !!(choice && choice.analytics);
  }
  function decide(analytics) {
    choice = { version: KS.consentVersion, analytics: analytics, decidedAt: new Date().toISOString(), id: (choice && choice.id) || uuid() };
    try { localStorage.setItem(CONSENT, JSON.stringify(choice)); } catch (e) { /* holds for this visit */ }
    if (!analytics) clearAnalyticsStorage();
    render(false);
    // Proof of consent (random id, no personal data). Fire and forget.
    post('consent_log', { consent_id: choice.id, analytics: analytics, version: KS.consentVersion, locale: lang() });
    startStats();
  }
  $('#cookie-refuse').addEventListener('click', function () { decide(false); });
  $('#cookie-accept').addEventListener('click', function () { decide(true); });
  $('#cookie-save').addEventListener('click', function () { decide(toggle.checked); });
  $('#cookie-customize').addEventListener('click', function () { render(true); });
  $('#cookie-close').addEventListener('click', function () { render(false); });
  $$('[data-cookie-settings]').forEach(function (b) { b.addEventListener('click', function () { render(true); }); });
  render(false);

  function post(table, row) {
    if (!KS.url) return;
    fetch(KS.url + '/rest/v1/' + table, {
      method: 'POST',
      keepalive: true,
      headers: { apikey: KS.key, Authorization: 'Bearer ' + KS.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    }).catch(function () { /* statistics must never break the page */ });
  }

  // ── Statistics, only with consent (= SiteTracker.web.tsx) ─────────────────
  var VISITOR_MAX_AGE_MS = 395 * 24 * 3600000;
  function stored(storage, key, maxAgeMs) {
    try {
      var parts = (storage.getItem(key) || '').split('|');
      if (parts[0] && Date.now() - Number(parts[1] || 0) < (maxAgeMs || Infinity)) return parts[0];
      var fresh = uuid();
      storage.setItem(key, fresh + '|' + Date.now());
      return fresh;
    } catch (e) {
      return uuid();
    }
  }
  function event(kind) {
    var w = window.innerWidth;
    var referrer = null;
    try {
      var host = document.referrer ? new URL(document.referrer).hostname : '';
      if (host && host !== location.hostname) referrer = host.replace(/^www\./, '');
    } catch (e) { referrer = null; }
    post('site_events', {
      visitor_id: stored(localStorage, 'kartup-vid', VISITOR_MAX_AGE_MS),
      session_id: stored(sessionStorage, 'kartup-sid'),
      kind: kind,
      // "/" shows the waitlist, as /join did in the app: one name for it in the dashboard.
      path: '/join',
      referrer: referrer ? referrer.slice(0, 200) : null,
      utm_source: (new URLSearchParams(location.search).get('utm_source') || '').slice(0, 80) || null,
      device: w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop',
    });
  }
  var statsTimer = null;
  function startStats() {
    var allowed = !!(choice && choice.analytics);
    if (allowed && !statsTimer) {
      event('pageview');
      statsTimer = setInterval(function () { if (document.visibilityState === 'visible') event('heartbeat'); }, 60000);
    } else if (!allowed && statsTimer) {
      clearInterval(statsTimer);
      statsTimer = null;
    }
  }
  startStats();
})();
