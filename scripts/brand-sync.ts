/**
 * Regenerates everything derived from config/brand.ts:
 *   1. Placeholder logo images (app icon, Android adaptive icon, splash, favicon)
 *   2. Supabase auth email templates (supabase/templates/*.html)
 *   3. Legal texts bundled in the app (apps/mobile/src/generated/legal.ts)
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
console.log('done.');
