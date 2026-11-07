/**
 * Regenerates everything derived from config/brand.ts:
 *   1. Placeholder logo images (app icon, Android adaptive icon, splash, favicon)
 *   2. Supabase auth email templates (supabase/templates/*.html)
 *   3. Legal texts bundled in the app (apps/mobile/src/generated/legal.ts)
 *   4. The website's page for Google and link previews, robots.txt and sitemap.xml (apps/mobile/public),
 *      including the instant first view of the waitlist page (shown while the app's code downloads)
 *
 * Run: npm run brand:sync   (also runs automatically before `npm run web`)
 * When the real logo exists, put the files in apps/mobile/assets/images and run
 * with --skip-images so they are not overwritten.
 */
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brand } from '../config/brand.ts';
import { renderEmail } from '../config/email-templates.ts';
import en from '../apps/mobile/src/i18n/en.ts';
import ro from '../apps/mobile/src/i18n/ro.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fontFile = join(root, 'node_modules/@expo-google-fonts/barlow-condensed/900Black_Italic/BarlowCondensed_900Black_Italic.ttf');
const fontFile2 = join(root, 'node_modules/@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf');
const images = join(root, 'apps/mobile/assets/images');
const BG = brand.colors.splashBackground;
const ACCENT = brand.colors.accent;

function write(path: string, data: string | Buffer) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log('  ✓', path.replace(root + '/', ''));
}

function png(svg: string, width: number): Buffer {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: [fontFile, fontFile2], loadSystemFonts: false, defaultFontFamily: 'Barlow Condensed' },
  })
    .render()
    .asPng();
}

/** Small checkered-flag accent: `cols`×`rows` squares starting at x,y. */
function checkers(x: number, y: number, size: number, cols: number, rows: number, color = '#FFFFFF') {
  let out = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if ((r + c) % 2 === 0) out += `<rect x="${x + c * size}" y="${y + r * size}" width="${size}" height="${size}" fill="${color}"/>`;
  // flag pole
  return out;
}

/** The wordmark: lead in `leadColor`, accent part in the accent color, centered at cx. */
function wordmark(cx: number, baseline: number, fontSize: number, leadColor = '#FFFFFF', accentColor = ACCENT) {
  return `<text x="${cx}" y="${baseline}" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-style="italic" font-size="${fontSize}" letter-spacing="${fontSize * 0.01}"><tspan fill="${leadColor}">${brand.wordmark.lead}</tspan><tspan fill="${accentColor}">${brand.wordmark.accent}</tspan></text>`;
}

function speedLine(cx: number, y: number, width: number, height: number, color = ACCENT) {
  const x = cx - width / 2;
  return `<polygon points="${x + height},${y} ${x + width},${y} ${x + width - height},${y + height} ${x},${y + height}" fill="${color}"/>`;
}

function logoSvg(size: number, opts: { background: boolean; scale: number; mono?: boolean }) {
  const s = size;
  const fs = s * 0.25 * opts.scale;
  const cx = s / 2;
  const baseline = s / 2 + fs * 0.32;
  const sq = fs * 0.085;
  const flagW = sq * 6;
  const lead = opts.mono ? '#FFFFFF' : '#FFFFFF';
  const acc = opts.mono ? '#FFFFFF' : ACCENT;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  ${opts.background ? `<rect width="${s}" height="${s}" fill="${BG}"/>` : ''}
  ${checkers(cx + fs * 1.05 - flagW, baseline - fs * 1.08, sq, 6, 3, opts.mono ? '#FFFFFF' : '#FFFFFF')}
  ${wordmark(cx, baseline, fs, lead, acc)}
  ${speedLine(cx - fs * 0.35, baseline + fs * 0.16, fs * 1.3, fs * 0.07, acc)}
</svg>`;
}

function splashSvg() {
  const w = 1200;
  const h = 640;
  const fs = 300;
  const cx = w / 2;
  const baseline = 330;
  const sq = 22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${checkers(cx + 330 - sq * 8, baseline - 300, sq, 8, 3)}
  ${wordmark(cx, baseline, fs)}
  ${speedLine(cx - 120, baseline + 40, 420, 18)}
  <text x="${cx}" y="${baseline + 170}" text-anchor="middle" font-family="Barlow Condensed" font-weight="600" font-size="78" fill="#A3A3AD" letter-spacing="2">${brand.slogan.replace('&', '&amp;')}</text>
</svg>`;
}

function faviconSvg() {
  const s = 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="12" fill="${BG}"/>
  ${checkers(40, 8, 5, 3, 3)}
  <text x="27" y="50" text-anchor="middle" font-family="Barlow Condensed" font-weight="900" font-style="italic" font-size="48" fill="${ACCENT}">${brand.wordmark.lead[0]}</text>
  ${speedLine(30, 54, 40, 4)}
</svg>`;
}

const skipImages = process.argv.includes('--skip-images');
console.log(`brand:sync → ${brand.name} — "${brand.slogan}"`);

if (!skipImages) {
  write(join(images, 'icon.png'), png(logoSvg(1024, { background: true, scale: 1.2 }), 1024));
  // Android adaptive icon: content must fit the central ~66% safe zone.
  write(join(images, 'android-icon-foreground.png'), png(logoSvg(1024, { background: false, scale: 0.78 }), 1024));
  write(join(images, 'android-icon-monochrome.png'), png(logoSvg(1024, { background: false, scale: 0.78, mono: true }), 1024));
  write(join(images, 'android-icon-background.png'), png(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${BG}"/></svg>`, 1024));
  write(join(images, 'splash-icon.png'), png(splashSvg(), 1200));
  write(join(images, 'favicon.png'), png(faviconSvg(), 64));
}

for (const kind of ['confirmation', 'recovery'] as const) {
  write(join(root, `supabase/templates/${kind}.html`), renderEmail(kind, '{{ .ConfirmationURL }}').html);
}

function fillLegal(md: string) {
  return md
    .replaceAll('{{APP_NAME}}', brand.name)
    .replaceAll('{{SLOGAN}}', brand.slogan)
    .replaceAll('{{LEGAL_ENTITY}}', brand.legalEntity)
    .replaceAll('{{LEGAL_ADDRESS}}', brand.legalAddress)
    .replaceAll('{{SUPPORT_EMAIL}}', brand.supportEmail)
    .replaceAll('{{DATE}}', brand.legalLastUpdated);
}
const privacy = fillLegal(readFileSync(join(root, 'legal/privacy-policy.md'), 'utf8'));
const terms = fillLegal(readFileSync(join(root, 'legal/terms.md'), 'utf8'));
write(
  join(root, 'apps/mobile/src/generated/legal.ts'),
  `// GENERATED by scripts/brand-sync.ts from legal/*.md — do not edit by hand.\nexport const privacyPolicy = ${JSON.stringify(privacy)};\nexport const termsOfService = ${JSON.stringify(terms)};\n`,
);

// ── Website: what Google and link previews read (they don't run JavaScript) ──────────
const site = brand.siteUrl.replace(/\/$/, '');
const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const jsonLd = JSON.stringify([
  { '@context': 'https://schema.org', '@type': 'Organization', name: brand.name, url: `${site}/`, logo: `${site}/icon-512.png`, slogan: brand.slogan, email: brand.supportEmail },
  { '@context': 'https://schema.org', '@type': 'WebSite', name: brand.name, url: `${site}/`, inLanguage: ['ro', 'en'] },
]).replaceAll('<', '\\u003c');
const publicDir = join(root, 'apps/mobile/public');

// ── Instant first view of the waitlist page ─────────────────────────────────────
// Plain HTML + CSS painted straight away, while the app's JavaScript downloads (seconds on a
// slow phone connection). Same texts, colours and sizes as the real hero (src/app/join.tsx), so
// the switch is invisible; the app removes it the moment the real page is on screen.
// Only on / and /join. Language and theme follow the visitor's saved choice, like the app.
mkdirSync(join(publicDir, 'fonts'), { recursive: true });
// The app's 4 fonts, under fixed names: index.html starts downloading them together with the
// app's code, and the app (on the web) loads them from these same addresses, so they are ready
// the moment the page is drawn instead of being requested afterwards (see WEB_FONTS in _layout.tsx).
const WEB_FONT_FILES = {
  BarlowCondensed_600SemiBold: '600SemiBold',
  BarlowCondensed_700Bold: '700Bold',
  BarlowCondensed_800ExtraBold: '800ExtraBold',
  BarlowCondensed_900Black_Italic: '900Black_Italic',
};
for (const [family, dir] of Object.entries(WEB_FONT_FILES)) {
  writeFileSync(join(publicDir, 'fonts', `${family}.ttf`), readFileSync(join(root, `node_modules/@expo-google-fonts/barlow-condensed/${dir}/${family}.ttf`)));
}
const hero = (lang: 'en' | 'ro') => {
  const j = (lang === 'en' ? en : ro).join;
  return `<div class="ks-wrap ks-l-${lang}">
        <p class="ks-slogan">${esc(brand.slogan.toUpperCase())}</p>
        <div class="ks-badges"><span class="ks-badge">${esc(j.badge)}</span><span class="ks-note">${esc(j.badgeNote)}</span></div>
        <h1 class="ks-h1">${esc(j.headline1)}<br />${esc(j.headline2)}<span class="ks-acc">${esc(j.headlineAccent)}</span></h1>
        <p class="ks-lead">${esc(j.body)}</p>
        <p class="ks-tag">${esc(j.tagline)}</p>
        <button type="button" class="ks-cta">${esc(j.cta)}</button>
      </div>`;
};
const shellCss = `
    @font-face { font-family: KartUPShell; src: url(/fonts/BarlowCondensed_900Black_Italic.ttf) format('truetype'); font-display: block; }
    #ks-shell { position: fixed; inset: 0; z-index: 10; overflow: hidden; background: var(--bg); color: var(--tx);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    #ks-shell[hidden] { display: none; }
    #ks-shell.ks-light { --bg: #E2DAC2; --tx: #181818; --mu: #45403A; --ac: #EC4624; --on: #FFFFFF; }
    #ks-shell.ks-dark { --bg: #222A2A; --tx: #E2DAC2; --mu: #B4AE9E; --ac: #F39120; --on: #222A2A; }
    #ks-shell .ks-l-en, #ks-shell .ks-l-ro { display: none; }
    #ks-shell.ks-en .ks-l-en, #ks-shell.ks-ro .ks-l-ro { display: flex; }
    .ks-nav { height: 62px; padding: 0 16px; display: flex; align-items: center; font: italic 900 26px/1 KartUPShell, 'Arial Narrow', sans-serif; }
    .ks-nav b { color: var(--ac); font-weight: 900; }
    .ks-stripe { height: 12px; background: repeating-conic-gradient(var(--tx) 0 25%, var(--bg) 0 50%) 0 0 / 12px 12px; }
    .ks-wrap { flex-direction: column; gap: 16px; max-width: 1160px; margin: 0 auto; padding: 32px 16px; box-sizing: border-box; }
    .ks-slogan, .ks-h1, .ks-tag { margin: 0; font-family: KartUPShell, 'Arial Narrow', sans-serif; font-style: italic; font-weight: 900; }
    .ks-slogan { color: var(--ac); font-size: 22px; line-height: 1.02; }
    .ks-badges { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .ks-badge, .ks-note { font-size: 12px; line-height: 16px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
    .ks-badge { color: var(--ac); border: 1px solid var(--ac); border-radius: 4px; padding: 4px 8px; }
    .ks-note { color: var(--mu); }
    .ks-h1 { font-size: 52px; line-height: 1.02; }
    .ks-acc { color: var(--ac); }
    .ks-lead { margin: 0; max-width: 600px; font-size: 18px; line-height: 28px; }
    .ks-tag { font-size: 22px; line-height: 1.02; }
    .ks-cta { align-self: flex-start; border: 0; cursor: pointer; background: var(--ac); color: var(--on); border-radius: 10px; padding: 16px 20px;
      transition: transform .12s ease, opacity .12s ease; -webkit-tap-highlight-color: transparent;
      font: 700 16px/20px 'Arial Narrow', sans-serif; letter-spacing: 1px; text-transform: uppercase; }
    .ks-cta:active, .ks-cta.ks-pressed { transform: scale(.97); opacity: .85; }
    @media (min-width: 900px) { .ks-slogan { font-size: 28px; } .ks-h1 { font-size: 96px; } .ks-tag { font-size: 26px; } }`;
const shellHtml = `<div id="ks-shell" hidden>
      <div class="ks-nav">Kart<b>UP</b></div>
      <div class="ks-stripe"></div>
      ${hero('en')}
      ${hero('ro')}
    </div>
    <script>
      (function () {
        var shell = document.getElementById('ks-shell');
        var path = location.pathname.replace(/\\/$/, '') || '/';
        if (path !== '/' && path !== '/join') { shell.remove(); return; }
        var prefs = {};
        try { prefs = JSON.parse(localStorage.getItem('kartup-preferences') || '{}').state || {}; } catch (e) {}
        var lang = prefs.locale || ((navigator.language || 'en').slice(0, 2).toLowerCase() === 'ro' ? 'ro' : 'en');
        var theme = prefs.theme || 'light';
        if (theme === 'system') theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        shell.className = 'ks-' + theme + ' ks-' + lang;
        shell.hidden = false;
        // A tap on the button before the page has fully loaded is kept: the page then opens at the form.
        shell.addEventListener('click', function (e) {
          var b = e.target.closest && e.target.closest('.ks-cta');
          if (!b) return;
          window.__ksGoToForm = true;
          b.classList.add('ks-pressed');
        });
      })();
    </script>`;

write(
  join(publicDir, 'index.html'),
  `<!DOCTYPE html>
<!-- GENERATED by scripts/brand-sync.ts from config/brand.ts — do not edit by hand. -->
<html lang="ro">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    <title>${esc(brand.seo.title)}</title>
    <link rel="canonical" href="${site}/" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="application-name" content="${esc(brand.name)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(brand.name)}" />
    <meta property="og:locale" content="ro_RO" />
    <meta property="og:locale:alternate" content="en_US" />
    <meta property="og:url" content="${site}/" />
    <meta property="og:title" content="${esc(brand.seo.shareTitle)}" />
    <meta property="og:description" content="${esc(brand.seo.shareDescription)}" />
    <meta property="og:image" content="${site}/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(brand.name)} — Be on the grid before anyone else." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(brand.seo.shareTitle)}" />
    <meta name="twitter:description" content="${esc(brand.seo.shareDescription)}" />
    <meta name="twitter:image" content="${site}/og-image.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <script type="application/ld+json">${jsonLd}</script>
    <!-- The react-native-web style reset: https://necolas.github.io/react-native-web/docs/setup/#root-element -->
${Object.keys(WEB_FONT_FILES)
  .map((f) => `    <link rel="preload" href="/fonts/${f}.ttf" as="font" type="font/ttf" crossorigin />`)
  .join('\n')}
    <style id="expo-reset">
      html, body { height: 100%; margin: 0; }
      body { overflow: hidden; }
      #root { display: flex; height: 100%; flex: 1; }
    </style>
    <style id="ks-shell-css">${shellCss}
    </style>
  </head>
  <body>
    <noscript>
      <h1>${esc(brand.seo.shareTitle)}</h1>
      <p>${esc(brand.seo.description)}</p>
      <p>Activează JavaScript ca să folosești ${esc(brand.name)}. · Enable JavaScript to use ${esc(brand.name)}.</p>
    </noscript>
    <div id="root"></div>
    ${shellHtml}
  </body>
</html>
`,
);
write(
  join(publicDir, 'robots.txt'),
  `# GENERATED by scripts/brand-sync.ts — do not edit by hand.
User-agent: *
Allow: /
# Signed-in parts of the app: nothing for search engines there.
Disallow: /admin
Disallow: /dev
Disallow: /settings
Disallow: /profile
Disallow: /session/
Disallow: /user/
Disallow: /onboarding
Disallow: /auth/
Disallow: /reset-password

Sitemap: ${site}/sitemap.xml
`,
);
write(
  join(publicDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED by scripts/brand-sync.ts — do not edit by hand. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${brand.seo.pages
  .map(
    (p) => `  <url>
    <loc>${site}${p}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <xhtml:link rel="alternate" hreflang="ro" href="${site}/" />
    <xhtml:link rel="alternate" hreflang="en" href="${site}/en/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${site}/" />
  </url>`,
  )
  .join('\n')}
</urlset>
`,
);
console.log('done.');
