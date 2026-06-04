import { useEffect, useState } from 'react';
import { SMALL_SCREEN_MAX } from '@/components/platform/designTokens';

/**
 * Subscribe to a CSS media query and report whether it currently matches.
 *
 * This is the single primitive every responsive hook in the app builds on,
 * so the `matchMedia` plumbing (modern `addEventListener`, the older Safari
 * `addListener` fallback, the SSR / no-`matchMedia` guard) lives in one place
 * rather than being copied per hook.
 *
 * `ssrDefault` is returned when `window.matchMedia` is unavailable (SSR, or a
 * test environment that has not stubbed it). The primary experience is the
 * full 1280+ laptop layout, so callers default to `false` for "is small".
 */
export function useMediaQuery(query: string, ssrDefault = false): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return ssrDefault;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    // addEventListener is the modern API; older Safari used addListener.
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query]);

  return matches;
}

/**
 * True on phone/tablet viewports (narrower than the `tablet` breakpoint,
 * 768px). Drives the small-screen notice and the chart scroll-container
 * fallbacks. Defaults to `false` (the laptop layout) when `matchMedia` is
 * unavailable.
 */
export function useIsSmallScreen(): boolean {
  return useMediaQuery(`(max-width: ${SMALL_SCREEN_MAX - 1}px)`);
}
