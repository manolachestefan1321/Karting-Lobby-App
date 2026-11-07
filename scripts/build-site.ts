/**
 * Builds the standalone waitlist page (kartup.ro/ and /join) into apps/mobile/dist, next to the
 * app's web export. Run by `npm run site:build` after `expo export`.
 *
 * Why: the waitlist page used to be part of the app, so every visitor downloaded the whole app
 * (~740 KB) before the button worked. This page is plain HTML + CSS + a little JavaScript
 * (~25 KB, animations ~50 KB loaded afterwards), so it works almost instantly on any phone.
 *
 * Everything that must stay identical to the app is taken from the app's own sources here:
 * texts (src/i18n), ranks (config/progression), brand and SEO tags (public/index.html from
 * brand-sync), the email rule (zod), the consent version (src/features/web/consent.ts).
 * The app version of the page (src/app/join.tsx) remains for development and the demo.
 *
 * Output: dist/index.html and dist/join.html (the page), dist/app.html (the app, served for
 * every other address via _redirects), dist/site/* (scripts with a fingerprint in the name).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { regexes } from 'zod';
import { brand } from '../config/brand.ts';
import { RANKS } from '../config/progression.ts';
import { APP_ROUTES } from '../site/app-routes.ts';
import en from '../apps/mobile/src/i18n/en.ts';
import ro from '../apps/mobile/src/i18n/ro.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = join(root, 'apps/mobile');
const dist = join(mobile, 'dist');
const site = join(root, 'site');

if (!existsSync(join(dist, 'index.html')) && !existsSync(join(dist, 'app.html'))) {
  console.error('apps/mobile/dist is missing: run `npm run site:build` (it exports the app first).');
  process.exit(1);
}

// ── Settings ────────────────────────────────────────────────────────────────
function envFile(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(join(mobile, '.env'), 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    );
  } catch {
    return {};
  }
}
const env = { ...envFile(), ...process.env };
const supabaseUrl = (env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const supabaseKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
if (!supabaseUrl || !supabaseKey) {
  // A page whose form can't save sign-ups must never go online.
  console.error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set (apps/mobile/.env): the form could not save sign-ups.');
  process.exit(1);
}
const consentVersion = /CONSENT_VERSION = '([^']+)'/.exec(readFileSync(join(mobile, 'src/features/web/consent.ts'), 'utf8'))?.[1];
if (!consentVersion) throw new Error('CONSENT_VERSION not found in src/features/web/consent.ts');

// ── Texts: both languages are in the page, CSS shows the visitor's one ─────
type Dict = typeof en;
const get = (d: Dict, key: string): string => {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], d);
  if (typeof v !== 'string') throw new Error(`Missing text: ${key}`);
  return v;
};
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const fill = (s: string, params: Record<string, string | number> = {}) => s.replace(/{{\s*(\w+)\s*}}/g, (_, k: string) => String(params[k] ?? ''));
/** Text in both languages. */
const t = (key: string, params?: Record<string, string | number>) =>
  `<span data-l="en">${esc(fill(get(en, key), params))}</span><span data-l="ro">${esc(fill(get(ro, key), params))}</span>`;
/** Headline words, numbered for the staggered entrance; `n` continues the count. */
function words(key: string, start: number, cls = '') {
  const out = (d: Dict, lang: string) =>
    `<span data-l="${lang}">${get(d, key)
      .split(' ')
      .filter(Boolean)
      .map((w, i) => `<span class="w${cls}" style="--i:${start + i}">${esc(w)}</span>`)
      .join(' ')}</span>`;
  return `${out(en, 'en')}${out(ro, 'ro')}`;
}
const count = (key: string) => Math.max(get(en, key).split(' ').filter(Boolean).length, get(ro, key).split(' ').filter(Boolean).length);

// Strings the script writes (errors) or sets as attributes.
const DICT_KEYS = ['validation.required', 'validation.tooLong', 'validation.email', 'validation.phone', 'validation.consent', 'errors.generic', 'errors.network', 'seo.title', 'seo.description', 'settings.themeLight', 'settings.themeDark'];
const dict = Object.fromEntries((['en', 'ro'] as const).map((l) => [l, Object.fromEntries(DICT_KEYS.map((k) => [k, get(l === 'en' ? en : ro, k)]))]));

// ── Icons (inline SVG, no icon font) ────────────────────────────────────────
const icon = {
  sun: '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
  lock: '<svg class="lock" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V7a3 3 0 0 0-6 0v3z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.2-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z"/></svg>',
};

// ── Page ────────────────────────────────────────────────────────────────────
const h1 = count('join.headline1');
const h2 = count('join.headline2');
const streaks = [
  ['14%', '38%', '0s'], ['31%', '24%', '.55s'], ['52%', '44%', '1.1s'], ['68%', '28%', '.3s'],
  ['22%', '30%', '1.4s'], ['83%', '36%', '.85s'], ['43%', '20%', '1.6s'],
];
const trackV = 'M24 0 C 44 100, 4 200, 24 300 S 44 500, 24 600';
const trackH = 'M0 32 C 50 6, 80 6, 100 32 S 200 58, 300 32 S 450 6, 500 32 S 580 58, 600 32';
const fmt = (n: number) => n.toLocaleString('en-US');

const field = (name: string, labelKey: string, attrs: string) => `
          <div class="field">
            <label for="f-${name}">${t(labelKey)}</label>
            <input id="f-${name}" name="${name}" ${attrs} />
            <p class="err" data-err="${name}" hidden></p>
          </div>`;

const body = `
<header class="nav">
  <div class="nav-in">
    <a class="logo" href="/" aria-label="${esc(brand.name)}">
      <span class="row"><span class="wd">${esc(brand.wordmark.lead)}<span class="acc">${esc(brand.wordmark.accent)}</span></span><span class="flag" aria-hidden="true">${'<i></i>'.repeat(12)}</span></span>
      <span class="speed" aria-hidden="true"></span>
    </a>
    <nav class="links">
      <button class="link label" id="lang-toggle" type="button"><span data-l="ro">EN</span><span data-l="en">RO</span></button>
      <button class="link" id="theme-toggle" type="button">${icon.sun}${icon.moon}</button>
      <a class="link label home" href="/welcome" data-home>${t('web.home')}</a>
      <button class="nav-cta" type="button" data-to-form>${t('web.join')}</button>
    </nav>
  </div>
</header>
<div class="stripe" aria-hidden="true"></div>

<main>
  <section class="hero">
    <!--
      VIDEO PLACEHOLDER: when there is footage, add a muted looping background video here, e.g.
      <video class="hero-video" src="/hero-loop.mp4" poster="/hero-poster.jpg" autoplay muted loop playsinline preload="none"></video>
      (absolute, full size, object-fit: cover, a dark overlay for contrast, under ~2 MB). Start it
      after the page is interactive (set preload/src from a script) so it never slows the first view.
    -->
    <div class="speed-lines" aria-hidden="true">${streaks.map(([top, w, d]) => `<i style="top:${top};width:${w};animation-delay:${d}"></i>`).join('')}</div>
    <div class="wrap">
      <p class="slogan fx" style="--i:0">${esc(brand.slogan.toUpperCase())}</p>
      <div class="badges fx" style="--i:1"><span class="badge cap">${t('join.badge')}</span><span class="cap muted">${t('join.badgeNote')}</span></div>
      <h1 class="hl">${words('join.headline1', 0)}<br />${words('join.headline2', h1)} <span class="acc">${words('join.headlineAccent', h1 + h2)}</span></h1>
      <p class="lead fx" style="--i:2">${t('join.body')}</p>
      <p class="tag fx" style="--i:3">${t('join.tagline')}</p>
      <div class="cta-row"><button class="btn cta" type="button" data-to-form><span class="lb">${t('join.cta')}</span></button></div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <h2 class="display rv">${t('join.whyTitle')}</h2>
      <div class="cards">
        ${(['first', 'priority', 'history'] as const)
          .map(
            (c) => `<div class="card-slot rv"><div class="card hc">
          <p class="cap acc-text">${t(`join.cards.${c}.kicker`)}</p>
          <h3 class="heading">${t(`join.cards.${c}.title`)}</h3>
          <p class="muted">${t(`join.cards.${c}.body`)}</p>
        </div></div>`,
          )
          .join('\n        ')}
      </div>
      <div class="flow rv">
        <span class="chip">${t('join.flow.heats')}</span>${icon.arrow}<span class="chip">${t('join.flow.final')}</span>${icon.arrow}<span class="chip on">${t('join.flow.podium')}</span>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="rv">
        <p class="cap acc-text">${t('join.how.kicker')}</p>
        <h2 class="display">${t('join.how.title')}</h2>
      </div>
      <div class="steps">
        <svg class="track track-v" viewBox="0 0 48 600" preserveAspectRatio="none" aria-hidden="true"><path class="base" d="${trackV}" fill="none" stroke-width="3" stroke-linecap="round"/><path class="draw" d="${trackV}" pathLength="1" fill="none" stroke-width="4" stroke-linecap="round"/></svg>
        <svg class="track track-h" viewBox="0 0 600 64" preserveAspectRatio="none" aria-hidden="true"><path class="base" d="${trackH}" fill="none" stroke-width="3" stroke-linecap="round"/><path class="draw" d="${trackH}" pathLength="1" fill="none" stroke-width="4" stroke-linecap="round"/></svg>
        ${(['city', 'lobby', 'race'] as const)
          .map(
            (s, i) => `<div class="step">
          <div class="step-badge"><span class="num">${i + 1}</span></div>
          <div class="step-body"><h3 class="heading">${t(`join.how.${s}.title`)}</h3><p class="muted">${t(`join.how.${s}.body`)}</p></div>
        </div>`,
          )
          .join('\n        ')}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="rv" style="display:flex;flex-direction:column;gap:8px">
        <p class="cap acc-text">${t('join.ranks.kicker')}</p>
        <h2 class="display">${t('join.ranks.title')}</h2>
        <p class="lead">${t('join.ranks.body')}</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="rank-bar" aria-hidden="true"><div class="rank-fill"></div></div>
        <div class="rank-grid">
          ${RANKS.map((r, i) => {
            const top = i === RANKS.length - 1;
            return `<div class="rank-slot"><div class="rank hc${top ? ' top' : ''}">
            <span class="stripe-c" style="background:${r.color}"></span>
            <p class="cap muted">${top ? t('join.ranks.top') : String(i + 1).padStart(2, '0')}</p>
            <p class="rank-name">${esc(r.name.toUpperCase())}</p>
            <p class="cap muted" style="letter-spacing:0;font-weight:400;text-transform:none">${t('join.ranks.km', { km: fmt(r.minKm) })} · ${t('join.ranks.xp', { xp: fmt(r.minXp) })}</p>
            ${icon.lock}
          </div></div>`;
          }).join('\n          ')}
        </div>
      </div>
    </div>
  </section>

  <!-- Waitlist counter: add here once there is a real public count (never an invented number). -->

  <section class="section" id="form-section">
    <div class="wrap split">
      <div class="rv" style="display:flex;flex-direction:column;gap:12px">
        <h2 class="display big">${t('join.formTitle1')}<br />${t('join.formTitle2')}<span class="acc">${t('join.formTitleAccent')}</span></h2>
        <p class="lead">${t('join.formBody')}</p>
      </div>
      <div class="form rv">
        <form id="signup" novalidate>
          <div style="display:flex;flex-direction:column;gap:12px">
            <div class="row2">${field('firstName', 'join.firstName', 'type="text" autocomplete="given-name" enterkeyhint="next"')}${field('lastName', 'join.lastName', 'type="text" autocomplete="family-name" enterkeyhint="next"')}
            </div>${field('phone', 'join.phone', 'type="tel" inputmode="tel" autocomplete="tel" placeholder="+40 7xx xxx xxx" enterkeyhint="next"')}${field('email', 'join.email', 'type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="you@email.com" enterkeyhint="done"')}
            <div class="field">
              <label class="check"><input type="checkbox" name="consent" /><span>${t('join.consent')}</span></label>
              <p class="err" data-err="consent" hidden></p>
            </div>
            <p class="err" id="form-error" role="alert" hidden></p>
            <button class="btn full" id="submit" type="submit"><span class="lb">${t('join.submit')}</span><span class="spin" hidden></span></button>
          </div>
        </form>
        <div class="done" id="done" role="status" hidden>
          ${icon.check}
          <div id="done-created"><h3 class="heading">${t('join.doneTitle')}</h3><p class="muted">${t('join.doneBody')}</p></div>
          <div id="done-exists" hidden><h3 class="heading">${t('join.existsTitle')}</h3><p class="muted">${t('join.existsBody')}</p></div>
          <button class="btn sec full" id="another" type="button"><span class="lb">${t('join.another')}</span></button>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <p class="disclaimer"><strong>${t('join.disclaimerLabel')}</strong> ${t('join.disclaimer')}</p>
      <div class="footer">
        <span>${t('join.copyright', { year: new Date().getFullYear() })}</span>
        <nav>
          <a href="/legal/privacy">${t('cookies.privacyLink')}</a>
          <button type="button" data-cookie-settings>${t('cookies.settingsLink')}</button>
          <a href="/welcome" data-home>${t('join.backHome')}</a>
        </nav>
      </div>
    </div>
  </section>
</main>

<div class="cookie" id="cookie" hidden>
  <div class="cookie-card" aria-label="${esc(get(en, 'cookies.title'))}">
    <div class="cookie-body">
      <h2 class="heading only-simple">${t('cookies.title')}</h2>
      <h2 class="heading only-detailed">${t('cookies.settingsTitle')}</h2>
      <p class="small muted">${t('cookies.intro')} <a class="acc-text" href="/legal/privacy">${t('cookies.privacyLink')}</a></p>
      <div class="cat only-detailed"><div class="cat-head"><strong>${t('cookies.necessary.title')}</strong><span class="cap muted" style="letter-spacing:0;text-transform:none;font-weight:400">${t('cookies.alwaysOn')}</span></div>
        <p class="small muted">${t('cookies.necessary.body')}</p><p class="cap muted" style="letter-spacing:0;text-transform:none;font-weight:400">${t('cookies.necessary.items')}</p></div>
      <div class="cat only-detailed"><div class="cat-head"><strong>${t('cookies.analytics.title')}</strong><input class="switch" type="checkbox" id="cookie-analytics" aria-label="${esc(get(en, 'cookies.analytics.title'))}" /></div>
        <p class="small muted">${t('cookies.analytics.body')}</p><p class="cap muted" style="letter-spacing:0;text-transform:none;font-weight:400">${t('cookies.analytics.items')}</p></div>
      <div class="cat only-detailed"><div class="cat-head"><strong>${t('cookies.marketing.title')}</strong><span class="cap muted" style="letter-spacing:0;text-transform:none;font-weight:400">${t('cookies.notUsed')}</span></div>
        <p class="small muted">${t('cookies.marketing.body')}</p></div>
    </div>
    <!-- Refusing is as easy as accepting: same size and style, side by side. -->
    <div class="row2"><button class="btn sec" id="cookie-refuse" type="button"><span class="lb">${t('cookies.refuseAll')}</span></button><button class="btn sec" id="cookie-accept" type="button"><span class="lb">${t('cookies.acceptAll')}</span></button></div>
    <button class="btn sec only-simple" id="cookie-customize" type="button"><span class="lb">${t('cookies.customize')}</span></button>
    <button class="btn sec only-detailed" id="cookie-save" type="button"><span class="lb">${t('cookies.save')}</span></button>
    <button class="close-link only-detailed" id="cookie-close" type="button" hidden>${t('cookies.close')}</button>
  </div>
</div>`;

// ── Head: brand / SEO tags from the generated public/index.html ─────────────
const appHead = readFileSync(join(mobile, 'public/index.html'), 'utf8');
const headInner = appHead
  .slice(appHead.indexOf('<head>') + 6, appHead.indexOf('</head>'))
  .replace(/<style id="expo-reset">[\s\S]*?<\/style>/, '')
  .replace(/<style id="ks-shell-css">[\s\S]*?<\/style>/, '')
  .trim();

// Scripts that load after the page (fingerprinted names, cached forever by the host).
mkdirSync(join(dist, 'site'), { recursive: true });
function asset(name: string, content: string | Buffer): string {
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 10);
  const file = name.replace(/\.js$/, `.${hash}.js`);
  writeFileSync(join(dist, 'site', file), content);
  return `/site/${file}`;
}
const vendor = (p: string) => readFileSync(join(root, 'node_modules', p));
const gsapSrc = asset('gsap.js', vendor('gsap/dist/gsap.min.js'));
const stSrc = asset('scrolltrigger.js', vendor('gsap/dist/ScrollTrigger.min.js'));
const lenisSrc = asset('lenis.js', vendor('lenis/dist/lenis.min.js'));
const motionSrc = asset('motion.js', readFileSync(join(site, 'motion.js')));

const config = {
  url: supabaseUrl,
  key: supabaseKey,
  consentVersion,
  emailRe: regexes.email.source,
  dict,
};

// Before the first paint: the visitor's language and theme (same choice as the app), and motion
// only when the visitor allows it.
const boot = `(function(){var d=document.documentElement,p={};try{p=JSON.parse(localStorage.getItem('kartup-preferences')||'{}').state||{}}catch(e){}
var l=p.locale||(((navigator.languages&&navigator.languages[0])||navigator.language||'en').slice(0,2).toLowerCase()==='ro'?'ro':'en');
var t=p.theme||'light';if(t==='system')t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
d.lang=l;d.dataset.theme=t;if(!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('ks-motion');})();`;

const html = `<!DOCTYPE html>
<!-- GENERATED by scripts/build-site.ts — do not edit by hand (edit site/ and the app's texts). -->
<html lang="en" data-theme="light">
  <head>
    ${headInner}
    <script>${boot}</script>
    <style>${readFileSync(join(site, 'landing.css'), 'utf8')}</style>
    <script src="${gsapSrc}" defer></script>
    <script src="${stSrc}" defer></script>
    <script src="${lenisSrc}" defer></script>
    <script src="${motionSrc}" defer></script>
  </head>
  <body>${body}
    <script>window.KS=${JSON.stringify(config).replaceAll('<', '\\u003c')};</script>
    <script>${readFileSync(join(site, 'validate.js'), 'utf8')}</script>
    <script>${readFileSync(join(site, 'landing.js'), 'utf8')}</script>
  </body>
</html>
`;

// The app moves to app.html (every other address); the waitlist page is / and /join.
if (existsSync(join(dist, 'index.html')) && !readFileSync(join(dist, 'index.html'), 'utf8').includes('GENERATED by scripts/build-site.ts')) {
  renameSync(join(dist, 'index.html'), join(dist, 'app.html'));
}
writeFileSync(join(dist, 'index.html'), html);
writeFileSync(join(dist, 'join.html'), html);

// Addresses of the app (everything except / and /join) → app.html. Listed explicitly so it works
// the same on Netlify and Cloudflare Pages (static files always win; these paths have none).

writeFileSync(
  join(dist, '_redirects'),
  `# Generated by scripts/build-site.ts. / and /join are the waitlist page (index.html, join.html);
# the app's pages are served by app.html.
${APP_ROUTES.map((r) => `${r}  /app.html  200`).join('\n')}
`,
);
const headers = readFileSync(join(mobile, 'public/_headers'), 'utf8');
writeFileSync(join(dist, '_headers'), headers.includes('/site/*') ? headers : `${headers.trimEnd()}\n/site/*\n  Cache-Control: public, max-age=31536000, immutable\n`);

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
console.log(`Waitlist page: ${kb(Buffer.byteLength(html))} (+ animations after load). Written to apps/mobile/dist (index.html, join.html; app → app.html).`);
