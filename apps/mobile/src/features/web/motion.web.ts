import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

// Registered once, when the website code loads.
gsap.registerPlugin(ScrollTrigger);

const REDUCE = '(prefers-reduced-motion: reduce)';

/**
 * Website motion: Lenis smooth scrolling synced with GSAP ScrollTrigger, plus the page's animations.
 * Elements are found by their nativeID (the DOM id):
 *   hw-N        headline words, fast staggered reveal on load
 *   hero-…      other hero lines, quick fade-up on load (the CTA button is never hidden)
 *   reveal-…    fade-up when scrolled into view (batched, short stagger)
 *   step-N      "How it works" steps; #track-draw is the SVG line drawn while scrolling
 *   rcard-N     rank cards unlocked one by one along #rank-fill (scrubbed with scroll)
 *   count-waitlist   count-up number
 * Starting states live in CSS (SiteDecor.web.tsx) under `html.ks-anim`, which is added here
 * before the first paint, so nothing jumps. With reduced motion: no Lenis, no class, everything
 * is simply visible.
 * Returns scrollTo(y), which glides with Lenis when it runs.
 */
export function useSiteMotion(scroll: RefObject<ScrollView | null>) {
  const lenis = useRef<Lenis | null>(null);

  useLayoutEffect(() => {
    const node = (scroll.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
    if (!node || window.matchMedia(REDUCE).matches) return;
    const root = document.documentElement;
    root.classList.add('ks-anim');

    // React Native Web puts its own scrollTo({ x, y }) on the scroll element; Lenis
    // needs the browser's scrollTo({ top }). Use the browser's while Lenis runs.
    const rnScrollTo = Object.prototype.hasOwnProperty.call(node, 'scrollTo') ? node.scrollTo : null;
    node.scrollTo = Element.prototype.scrollTo;

    const smooth = new Lenis({ wrapper: node, content: node.firstElementChild as HTMLElement, smoothWheel: true, lerp: 0.12 });
    lenis.current = smooth;
    smooth.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => smooth.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const q = (sel: string) => gsap.utils.toArray<HTMLElement>(sel, node);
    const mm = gsap.matchMedia();
    mm.add(
      { mobile: `(max-width: 767px) and (prefers-reduced-motion: no-preference)`, desktop: `(min-width: 768px) and (prefers-reduced-motion: no-preference)` },
      (ctx) => {
        const mobile = !!ctx.conditions?.mobile;
        const st = { scroller: node };

        // Hero: short and fast, finished in well under a second. The form button is never animated.
        gsap
          .timeline({ defaults: { ease: 'power4.out' } })
          .to(q('[id^="hw-"]'), { y: 0, opacity: 1, duration: 0.5, stagger: 0.045 })
          .to(q('[id^="hero-"]'), { y: 0, opacity: 1, duration: 0.4, stagger: 0.05 }, 0.12);

        // Pause the speed lines while the hero is off screen (no work for nothing).
        const lines = node.querySelector('#speed-lines');
        const hero = node.querySelector('#hero');
        if (lines && hero)
          ScrollTrigger.create({
            ...st,
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            onToggle: (self) => lines.classList.toggle('ks-paused', !self.isActive),
          });

        // Scroll reveals, batched so items entering together stagger nicely.
        ScrollTrigger.batch(q('[id^="reveal-"]'), {
          ...st,
          start: 'top 90%',
          once: true,
          onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: mobile ? 0.45 : 0.6, ease: 'power3.out', stagger: 0.08, overwrite: true }),
        });

        // How it works: steps slide in, the track line draws itself as you scroll.
        const steps = node.querySelector('#how-steps');
        if (steps) {
          gsap.to(q('[id^="step-"]'), {
            x: 0,
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
            stagger: 0.12,
            scrollTrigger: { ...st, trigger: steps, start: 'top 80%', once: true },
          });
          gsap.to(q('#track-draw'), {
            strokeDashoffset: 0,
            ease: 'none',
            scrollTrigger: { ...st, trigger: steps, start: 'top 85%', end: mobile ? 'bottom 60%' : 'bottom 55%', scrub: mobile ? true : 0.4 },
          });
        }

        // Ranks: the bar fills and each rank unlocks in turn while the grid scrolls through.
        const grid = node.querySelector('#ranks-grid');
        const cards = q('[id^="rcard-"]');
        if (grid && cards.length) {
          const tl = gsap.timeline({
            scrollTrigger: { ...st, trigger: grid, start: 'top 80%', end: mobile ? 'bottom 70%' : 'bottom 60%', scrub: mobile ? true : 0.5 },
          });
          cards.forEach((card, i) => {
            tl.to(q('#rank-fill'), { scaleX: (i + 1) / cards.length, duration: 1, ease: 'none' })
              .to(card, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)' }, '<0.5')
              .to(q(`#rlock-${i}`), { opacity: 0, duration: 0.3 }, '<');
          });
        }

        // Waitlist counter: counts up once, the first time it is seen.
        const count = node.querySelector<HTMLElement>('#count-waitlist');
        if (count) {
          const target = Number(count.textContent?.replace(/\D/g, '') || 0);
          const fmt = new Intl.NumberFormat('en-US');
          const val = { n: 0 };
          count.textContent = fmt.format(0);
          gsap.to(val, {
            n: target,
            duration: mobile ? 1.1 : 1.4,
            ease: 'power2.out',
            onUpdate: () => void (count.textContent = fmt.format(Math.round(val.n))),
            scrollTrigger: { ...st, trigger: count, start: 'top 90%', once: true },
          });
          return () => void (count.textContent = fmt.format(target));
        }
        return undefined;
      },
      node,
    );

    // Web fonts change text height: re-measure the triggers once they are in.
    void document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => {
      mm.revert();
      root.classList.remove('ks-anim');
      gsap.ticker.remove(tick);
      smooth.destroy();
      lenis.current = null;
      if (rnScrollTo) node.scrollTo = rnScrollTo;
    };
  }, [scroll]);

  return (y: number) => {
    if (lenis.current) lenis.current.scrollTo(y, { duration: 1.1 });
    else scroll.current?.scrollTo({ y, animated: true });
  };
}
