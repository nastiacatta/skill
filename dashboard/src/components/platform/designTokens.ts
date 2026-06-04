/**
 * Platform design tokens — the typed, single source for spacing, radius,
 * shadow, motion, type, chart, and control sizing across the rebuilt
 * platform showcase and the refreshed research face.
 *
 * Tokens are sourced from the existing palette (`@/lib/palette`,
 * `@/lib/tokens`) and the CSS variables declared in `src/index.css`.
 * No new colour hex literals are introduced here: colour roles point at
 * the canonical maps (`SEM`, `PALETTE`, `VERDICT_COLOURS`).
 *
 * Spec: platform design-system notes.
 *
 * Other platform modules import from here rather than re-deriving values.
 */
import { PALETTE, VERDICT_COLOURS } from '@/lib/palette';
import { SEM } from '@/lib/tokens';

/* ── px floor (harness contract) ─────────────────────────────────────
   The visual-audit harness flags DOM text below `--min-font` (default
   12px). We design above that: 16px body, 13px smallest label. */
export const PX_FLOOR = {
  /** Smallest allowed DOM text (label / chip / axis). */
  minLabel: 13,
  /** Reading-copy floor. */
  body: 16,
  /** Chart axis tick-label floor. */
  chartAxis: 14,
  /** The harness default we sit above. */
  harnessDefault: 12,
} as const;

/* ── Spacing scale (4px base) ────────────────────────────────────────
   Numeric px values; keys mirror the Tailwind 4px step the codebase
   already uses. */
export const SPACE = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

/* ── Border-radius scale ─────────────────────────────────────────────*/
export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

/* ── Elevation / shadow scale ────────────────────────────────────────
   The first three mirror the `--shadow-*` CSS variables; `lift` is a
   higher hover/active level using the same ink shadow colour. */
export const SHADOW = {
  sm: '0 1px 0 rgba(15, 23, 42, 0.03)',
  md: '0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 12px -6px rgba(15, 23, 42, 0.06)',
  lg: '0 2px 4px rgba(15, 23, 42, 0.04), 0 16px 40px -12px rgba(15, 23, 42, 0.12)',
  lift: '0 4px 8px -2px rgba(15, 23, 42, 0.06), 0 24px 56px -16px rgba(15, 23, 42, 0.16)',
} as const;

/* ── Typography ladder ───────────────────────────────────────────────
   Sizes in px; families reference the CSS-variable font stacks. */
export const FONT = {
  sans: 'var(--font-sans)',
  serif: 'var(--font-serif)',
  mono: 'var(--font-mono)',
} as const;

export interface TypeStep {
  size: number;
  lineHeight: number;
  weight: number;
  family: string;
}

export const TYPE: Record<
  | 'label'
  | 'caption'
  | 'body'
  | 'lead'
  | 'h3'
  | 'h2'
  | 'h1'
  | 'display'
  | 'statL'
  | 'statXL',
  TypeStep
> = {
  label: { size: 13, lineHeight: 1.35, weight: 600, family: FONT.sans },
  caption: { size: 14, lineHeight: 1.45, weight: 500, family: FONT.sans },
  body: { size: 16, lineHeight: 1.55, weight: 400, family: FONT.sans },
  lead: { size: 18, lineHeight: 1.6, weight: 400, family: FONT.sans },
  h3: { size: 22, lineHeight: 1.4, weight: 600, family: FONT.serif },
  h2: { size: 28, lineHeight: 1.25, weight: 600, family: FONT.serif },
  h1: { size: 40, lineHeight: 1.15, weight: 600, family: FONT.serif },
  display: { size: 56, lineHeight: 1.08, weight: 700, family: FONT.serif },
  statL: { size: 44, lineHeight: 1.1, weight: 700, family: FONT.serif },
  statXL: { size: 64, lineHeight: 1.05, weight: 700, family: FONT.serif },
} as const;

/* ── Motion tokens ───────────────────────────────────────────────────
   Durations in ms; easings as cubic-bezier strings; springs as
   framer-motion transition objects; stagger and hover-reveal timings. */
export const DURATION = {
  instant: 120,
  fast: 180,
  base: 240,
  slow: 320,
  deliberate: 420,
  exit: 200,
} as const;

export const EASING = {
  /** ease-out — the default for entrances and most transitions. */
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  /** ease-in — for exits. */
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  /** slight overshoot — emphasis, settling numbers. */
  emphasised: 'cubic-bezier(0.2, 0, 0, 1.2)',
  /** symmetric — cross-view moves. */
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const SPRING = {
  soft: { type: 'spring', stiffness: 200, damping: 26 },
  snappy: { type: 'spring', stiffness: 320, damping: 30 },
} as const;

/** Choreography delays (ms). */
export const STAGGER = {
  item: 60,
  group: 120,
} as const;

/**
 * Framer-motion easing curves as cubic-bezier control-point arrays. These are
 * the same curves as EASING (which holds the CSS strings), expressed in the
 * `[x1, y1, x2, y2]` form framer-motion's `transition.ease` accepts. Components
 * reference these rather than inlining arrays, so all motion shares one set of
 * curves.
 */
export const EASE = {
  /** ease-out — entrances and most transitions. */
  standard: [0.2, 0, 0, 1],
  /** ease-in — exits. */
  exit: [0.4, 0, 1, 1],
  /** symmetric — cross-view and positional (FLIP) moves. */
  inOut: [0.4, 0, 0.2, 1],
} as const;

/**
 * Reusable framer-motion transition presets, in seconds (framer-motion's unit).
 * Built from DURATION + EASE so a component picks an intent, not a number.
 *  - `formUpdate`: a chart series reshaping in place (the quantile fan forming,
 *    the aggregate updating) — readable, not snappy.
 *  - `reorder`: positional FLIP moves (leaderboard rows changing rank).
 *  - `view`: a calm view / route entrance.
 *  - `micro`: hover / focus / selection micro-interactions.
 */
export const TRANSITION = {
  formUpdate: { duration: DURATION.slow / 1000, ease: EASE.inOut },
  reorder: { duration: DURATION.base / 1000, ease: EASE.inOut },
  view: { duration: DURATION.base / 1000, ease: EASE.standard },
  micro: { duration: DURATION.fast / 1000, ease: EASE.standard },
  /** Count-up tween for changing stat numbers. */
  count: { duration: DURATION.deliberate / 1000, ease: EASE.standard },
  /**
   * Chart entrance reveal: a line drawing on (`pathLength` 0→1), a band group
   * fading and expanding, markers settling in. Slightly longer than `view` so
   * the eye can follow the data appearing, ease-out. Used once on mount; the
   * round-to-round `formUpdate` tween governs subsequent reshapes.
   */
  draw: { duration: DURATION.deliberate / 1000, ease: EASE.standard },
} as const;

/** Hover-reveal timings (ms) for tooltips / asides. */
export const REVEAL = {
  feedback: 100,
  delay: 350,
  hide: 500,
} as const;

/* ── Iconography ─────────────────────────────────────────────────────*/
export const ICON = {
  sm: 16,
  md: 20,
  lg: 24,
  stroke: 1.5,
} as const;

/* ── Controls / touch targets ────────────────────────────────────────*/
export const CONTROL = {
  /** Minimum interactive target (px). */
  minTarget: 44,
  height: { sm: 36, md: 44, lg: 52 },
  /** Slider thumb diameter and hit area. */
  sliderThumb: 20,
  sliderHit: 44,
} as const;

/* ── Chart / visual minimums ─────────────────────────────────────────*/
export const CHART = {
  minHeight: { sm: 240, md: 320, lg: 420 },
  axisLabel: 14,
  title: 18,
  strokeWidth: { default: 2, emphasis: 3 },
} as const;

/* ── Breakpoints (px) ────────────────────────────────────────────────
   Single source of truth for every layout threshold. `phone` and
   `tablet` were added for P5 (responsive devices); the desktop tiers
   (lg/xl/xxl) are the primary laptop targets and predate it.

   - `phone`  (≤480) : single-column phone layout; large SVG charts get a
                       horizontal-scroll container so they stay legible.
   - `tablet` (≤768) : phone/tablet boundary. Below it the small-screen
                       "best on a laptop" notice shows. This is the value
                       `useIsSmallScreen` and the notice key off.
   - `md`     (1024) : nav-rail collapse threshold (icon-only below it).
   - `lg/xl`  (1280/1440) : primary laptop range, comfortable default.
   - `xxl`    (1920) : content capped, margins grow.

   The CSS media queries in `index.css` use the same literal px values;
   keep the two in sync (CSS cannot read these constants at parse time). */
export const BREAKPOINT = {
  phone: 480,
  tablet: 768,
  sm: 640,
  md: 1024,
  lg: 1280,
  xl: 1440,
  xxl: 1920,
} as const;

/** Viewports below this width (px) are treated as phone/tablet: the
 *  small-screen notice appears and large charts switch to scroll
 *  containers. Equals the `tablet` breakpoint. */
export const SMALL_SCREEN_MAX = BREAKPOINT.tablet;

/* ── Layout / app shell ──────────────────────────────────────────────*/
export const LAYOUT = {
  topBarHeight: 64,
  navRailWidth: 256,
  navRailWidthCompact: 240,
  navRailCollapsed: 64,
  contentMaxWidth: 1200,
  proseMaxWidth: 720,
  wideMaxWidth: 1440,
  pagePaddingX: { base: SPACE[6], wide: SPACE[10] },
} as const;

/* ── Colour roles (pointers into the canonical maps, no new hex) ─────
   Surface and ink roles reference CSS variables; concept colours
   reference `SEM`; verdicts reference `VERDICT_COLOURS`; brand accents
   reference the slide `PALETTE`. */
export const COLOUR = {
  surface: {
    paper: 'var(--paper)',
    alt: 'var(--cream)',
    card: 'var(--card)',
    border: 'var(--border)',
    borderStrong: 'var(--border-strong)',
  },
  ink: {
    base: 'var(--ink)',
    muted: 'var(--ink-muted)',
    soft: 'var(--ink-soft)',
    faint: 'var(--ink-faint)',
  },
  brand: {
    navy: PALETTE.navy,
    imperial: PALETTE.imperial,
    teal: PALETTE.teal,
    coral: PALETTE.coral,
    plum: PALETTE.purple,
  },
  /** One colour per mechanism concept; reuse, never re-key. */
  concept: SEM,
  /** WCAG-checked good / neutral / bad. */
  verdict: VERDICT_COLOURS,
} as const;

/** Map a StatTile delta direction to its verdict colour set. */
export type VerdictTone = 'good' | 'neutral' | 'bad';

/**
 * Single bundle re-export so a consumer can `import { tokens }` if they
 * prefer one namespace. Individual named exports above remain the
 * canonical entry points.
 */
export const tokens = {
  PX_FLOOR,
  SPACE,
  RADIUS,
  SHADOW,
  FONT,
  TYPE,
  DURATION,
  EASING,
  EASE,
  SPRING,
  STAGGER,
  TRANSITION,
  REVEAL,
  ICON,
  CONTROL,
  CHART,
  BREAKPOINT,
  LAYOUT,
  COLOUR,
} as const;
