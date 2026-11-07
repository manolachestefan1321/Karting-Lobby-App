/**
 * Website-only decoration for the waitlist page (React Native Web renders real DOM here).
 *  - SiteStyles: CSS for the animations' starting states, speed lines and hover effects.
 *    Starting states only apply while `html.ks-anim` is set (useSiteMotion adds it before the
 *    first paint and only when the visitor allows motion), so nothing can stay hidden.
 *  - SpeedLines: light CSS streaks behind the hero (transform + opacity only).
 *  - TrackLine: SVG race line connecting the "How it works" steps, drawn on scroll.
 * Native builds use SiteDecor.tsx, which renders nothing.
 */

export function SiteStyles({ accent, line }: { accent: string; line: string }) {
  return (
    <style>{`
#join-page { --ks-accent: ${accent}; --ks-line: ${line}; }

/* ── Starting states (motion allowed only) ─────────────────────────── */
html.ks-anim [id^="hw-"] { opacity: 0; transform: translate3d(0, 0.5em, 0); }
html.ks-anim [id^="hero-"] { opacity: 0; transform: translate3d(0, 16px, 0); }
html.ks-anim [id^="reveal-"] { opacity: 0; transform: translate3d(0, 32px, 0); }
html.ks-anim [id^="step-"] { opacity: 0; transform: translate3d(-32px, 0, 0); }
html.ks-anim [id^="rcard-"] { opacity: 0.3; transform: scale(0.94); }
html.ks-anim #rank-fill { transform: scaleX(0); }
html.ks-anim #track-draw { stroke-dashoffset: 1; }

/* Headline words move one by one: inline-block so transforms apply, spaces stay between them. */
[id^="hw-"] { display: inline-block; will-change: transform; }
#rank-fill { transform-origin: 0 50%; }
#track-draw { stroke-dasharray: 1; stroke-dashoffset: 0; }
/* Locks show only while a rank is still locked (i.e. only when animating). */
[id^="rlock-"] { opacity: 0; }
html.ks-anim [id^="rlock-"] { opacity: 1; }
#count-waitlist { font-variant-numeric: tabular-nums; }

/* ── Speed lines in the hero ───────────────────────────────────────── */
.ks-speed { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
.ks-speed i {
  position: absolute; left: 0; height: 2px; border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--ks-accent));
  opacity: 0; transform: translate3d(-120%, 0, 0);
  animation: ks-streak 1.8s cubic-bezier(.55, 0, .25, 1) infinite;
}
.ks-speed.ks-paused i { animation-play-state: paused; }
@keyframes ks-streak {
  0%   { transform: translate3d(-120%, 0, 0); opacity: 0; }
  20%  { opacity: .3; }
  100% { transform: translate3d(330%, 0, 0); opacity: 0; }
}
@media (max-width: 767px) { .ks-speed i:nth-child(n+5) { display: none; } }

/* ── Hover / press: only on devices with a real pointer ────────────── */
[id^="hc-"], [id^="btn-"] [role="button"] { transition: transform .15s ease, box-shadow .15s ease; }
@media (hover: hover) {
  [id^="hc-"]:hover { transform: translate3d(0, -3px, 0); box-shadow: 0 0 0 1px var(--ks-accent), 0 10px 30px -12px var(--ks-accent); }
  [id^="btn-"] [role="button"]:hover { transform: scale(1.03); box-shadow: 0 0 24px -4px var(--ks-accent); }
}
[id^="btn-"] [role="button"]:active { transform: scale(.97); }

@media (prefers-reduced-motion: reduce) {
  .ks-speed i { animation: none; opacity: .12; transform: none; width: 30% !important; }
  [id^="hc-"], [id^="btn-"] [role="button"] { transition: none; }
}
`}</style>
  );
}

// Fixed positions (no randomness) so the hero looks the same on every load.
const STREAKS = [
  { top: '14%', width: '38%', delay: '0s' },
  { top: '31%', width: '24%', delay: '.55s' },
  { top: '52%', width: '44%', delay: '1.1s' },
  { top: '68%', width: '28%', delay: '.3s' },
  { top: '22%', width: '30%', delay: '1.4s' },
  { top: '83%', width: '36%', delay: '.85s' },
  { top: '43%', width: '20%', delay: '1.6s' },
];

export function SpeedLines() {
  return (
    <div id="speed-lines" className="ks-speed" aria-hidden="true">
      {STREAKS.map((s) => (
        <i key={s.top} style={{ top: s.top, width: s.width, animationDelay: s.delay }} />
      ))}
    </div>
  );
}

/**
 * The line that connects the 3 steps. Horizontal on wide screens (passes through the centre of
 * each third), vertical on phones (along the step badges). pathLength=1 makes drawing easy:
 * stroke-dashoffset goes from 1 (hidden) to 0 (drawn).
 */
export function TrackLine({ vertical }: { vertical: boolean }) {
  const d = vertical ? 'M24 0 C 44 100, 4 200, 24 300 S 44 500, 24 600' : 'M0 32 C 50 6, 80 6, 100 32 S 200 58, 300 32 S 450 6, 500 32 S 580 58, 600 32';
  const box = vertical ? '0 0 48 600' : '0 0 600 64';
  const style = vertical
    ? ({ position: 'absolute', left: 0, top: 24, bottom: 24, width: 48, height: 'calc(100% - 48px)' } as const)
    : ({ position: 'absolute', left: 0, right: 0, top: 0, width: '100%', height: 64 } as const);
  return (
    <svg viewBox={box} preserveAspectRatio="none" aria-hidden="true" style={{ ...style, pointerEvents: 'none', overflow: 'visible' }}>
      <path d={d} fill="none" stroke="var(--ks-line)" strokeWidth={3} strokeLinecap="round" />
      <path id="track-draw" d={d} pathLength={1} fill="none" stroke="var(--ks-accent)" strokeWidth={4} strokeLinecap="round" />
    </svg>
  );
}
