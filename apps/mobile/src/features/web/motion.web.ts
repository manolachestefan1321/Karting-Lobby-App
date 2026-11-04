import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { useEffect, useRef, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

gsap.registerPlugin(ScrollTrigger);

/**
 * Website motion: Lenis smooth scrolling + GSAP reveals.
 *  - elements with nativeID "hero-…" slide in on load, one after another;
 *  - elements with nativeID "reveal-…" slide in when scrolled into view.
 * Skipped entirely when the visitor asks for reduced motion.
 * Returns a scrollTo(y) that glides with Lenis.
 */
export function useSiteMotion(scroll: RefObject<ScrollView | null>) {
  const lenis = useRef<Lenis | null>(null);

  useEffect(() => {
    const node = (scroll.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // React Native Web puts its own scrollTo({ x, y }) on the scroll element; Lenis
    // needs the browser's scrollTo({ top }). Use the browser's while Lenis runs.
    const rnScrollTo = Object.prototype.hasOwnProperty.call(node, 'scrollTo') ? node.scrollTo : null;
    node.scrollTo = Element.prototype.scrollTo;

    const smooth = new Lenis({ wrapper: node, content: node.firstElementChild as HTMLElement, smoothWheel: true, lerp: 0.1 });
    lenis.current = smooth;
    smooth.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => smooth.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      gsap.from('[id^="hero-"]', { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.09 });
      for (const el of gsap.utils.toArray<HTMLElement>('[id^="reveal-"]')) {
        gsap.from(el, { y: 48, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, scroller: node, start: 'top 88%' } });
      }
    }, node);

    return () => {
      ctx.revert();
      gsap.ticker.remove(tick);
      smooth.destroy();
      lenis.current = null;
      if (rnScrollTo) node.scrollTo = rnScrollTo;
    };
  }, [scroll]);

  return (y: number) => {
    if (lenis.current) lenis.current.scrollTo(y, { duration: 1.2 });
    else scroll.current?.scrollTo({ y, animated: true });
  };
}
