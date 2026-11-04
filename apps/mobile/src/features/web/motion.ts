import type { RefObject } from 'react';
import type { ScrollView } from 'react-native';

/**
 * Website motion (GSAP + Lenis) only runs on the web: see motion.web.ts.
 * On phones the page scrolls natively and nothing is animated.
 */
export function useSiteMotion(scroll: RefObject<ScrollView | null>) {
  return (y: number) => scroll.current?.scrollTo({ y, animated: true });
}
