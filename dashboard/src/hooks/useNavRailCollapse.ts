import { BREAKPOINT } from '@/components/platform/designTokens';
import { useMediaQuery } from './useMediaQuery';

/**
 * The nav rail is a layout state, not a manual toggle (design system,
 * `responsive_grid.md`): at or above `bp.md` (1024px) it is a full
 * labelled rail; below it collapses to a 64px icon-only rail with the
 * labels available as accessible tooltips. This hook reports whether the
 * rail should be collapsed, tracking the viewport via `matchMedia`.
 *
 * SSR / no-matchMedia environments default to the full (uncollapsed) rail,
 * which is the primary 1280+ experience. The `matchMedia` plumbing lives in
 * `useMediaQuery`; this hook only pins the breakpoint.
 */
export function useNavRailCollapse(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINT.md - 1}px)`);
}
