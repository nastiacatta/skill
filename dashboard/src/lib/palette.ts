/**
 * Single source of truth for chart/page colours across the whole dashboard.
 *
 * The core slide palette lives here, in the design-system layer. The
 * password-gated slide deck re-exports it from
 * `src/components/slides/shared/presentationConstants.ts`, which keeps the
 * slides in step with `presentation/R/theme_thesis.R` and
 * `onlinev2/src/onlinev2/plotting/style.py`. Defining it here (rather than
 * importing it from the slides layer) means the eager shell never pulls a
 * presentation module onto the first-paint path, while the main app, the
 * slide deck, the R-generated PNGs, and the Python-generated PNGs all show
 * the same colour for the same concept.
 *
 * Also exports:
 *   - `CB_PALETTE` — Wong (2011) colourblind-safe 8-colour palette
 *   - `VERDICT_COLOURS` — good/neutral/bad tokens with WCAG AA contrast
 *   - `METHOD_COLORS` — aggregation method → hex
 *   - `FORECASTER_COLOURS` — model name → hex (aliases for every variant)
 *   - `SCENARIO_COLOURS` — behaviour scenario → hex
 *   - `FAMILY_COLORS` — behaviour family → hex
 *   - `AGENT_COLORS` — ordered list for cycling through agents
 *   - Contrast helpers (relativeLuminance, contrastRatio)
 */

/**
 * Clean academic palette — single source of truth for all presentation colours.
 * Every colour used in text, SVG fills, or chart data series must come from this set.
 */
export const PALETTE = {
  // Primary
  navy: '#1B2A4A',        // Deep navy — headings, primary text
  white: '#FFFFFF',       // Backgrounds
  offWhite: '#F8FAFC',   // Slide backgrounds (light)

  // Accent
  imperial: '#003E74',    // Imperial blue — strong accent
  teal: '#2E8B8B',       // Teal — results, positive
  coral: '#E85D4A',      // Coral red — warnings, negative
  purple: '#7C3AED',     // Light purple — highlights, annotations

  // Neutral
  charcoal: '#2D3748',   // Body text
  slate: '#64748B',      // Secondary text, subtitles
  border: '#CBD5E1',     // Borders, grid lines
  lightBg: '#F1F5F9',    // Card backgrounds

  // Dark mode
  darkBg: '#0F172A',     // Dark slide backgrounds
  darkText: '#E2E8F0',   // Text on dark backgrounds
} as const;

/**
 * Warm orange — used for the MLP forecaster and as a neutral warm accent.
 * Matches `R FORECASTER_COLOURS.MLP` and Python `PALETTE[\"orange\"]`.
 * Not part of slide `PALETTE` because the slide deck has historically kept
 * orange out of the primary palette, but the dashboard uses it heavily
 * for the MLP / warm-accent role.
 */
export const ORANGE = '#E67E22';

// ─── Colourblind-safe palette (Wong 2011) ────────────────────────────
export const CB_PALETTE = [
  '#0072B2', // blue
  '#E69F00', // orange
  '#009E73', // green
  '#CC79A7', // pink
  '#56B4E9', // sky blue
  '#D55E00', // vermillion
  '#F0E442', // yellow
  '#000000', // black
] as const;

// ─── Verdict colours (WCAG AA) ───────────────────────────────────────
// good/neutral/bad tokens — fg colours are darkened variants that satisfy
// WCAG 4.5:1 contrast against the tinted bg; border keeps the slide-palette
// hue so the visual identity stays consistent with charts/slides.
export const VERDICT_COLOURS = {
  good:    { fg: '#115E59', bg: '#E7F3F1', border: PALETTE.teal },
  neutral: { fg: '#78350f', bg: '#FBF3E5', border: '#B45309' },
  bad:     { fg: '#991B1B', bg: '#FBECEF', border: PALETTE.coral },
} as const;

// ─── Aggregation method colour map ───────────────────────────────────
// Keeps the existing key set but swaps generic Tailwind tones for the
// slide palette. All slide charts, page charts, and table cells should
// look up method colours through this map.
export const METHOD_COLORS: Record<string, string> = {
  uniform:          PALETTE.slate,
  equal:            PALETTE.slate,
  deposit:          PALETTE.coral,
  stake:            PALETTE.coral,
  skill:            PALETTE.purple,
  mechanism:        PALETTE.teal,
  blended:          PALETTE.teal,
  best_single:      PALETTE.navy,
  oracle:           PALETTE.navy,
  inverse_variance: ORANGE, // warm orange, matches R FORECASTER_COLOURS.MLP
  trimmed_mean:     '#95A5A6',
  median:           PALETTE.charcoal,
  raja_history_free:       PALETTE.imperial,
  vitali_ogd_per_quantile: PALETTE.purple,
};

// ─── Forecaster colour map ───────────────────────────────────────────
// Key set covers every spelling of the seven base forecasters used
// across panels: short name (e.g. "EWMA"), parameterised variant
// (e.g. "EWMA(5)"), and descriptive ("Neural Net"). All variants map
// to the same slide/R colour so a forecaster is always the same hue.
const FC_BASE = {
  Naive:    PALETTE.navy,
  EWMA:     PALETTE.teal,
  ARIMA:    PALETTE.coral,
  XGBoost:  PALETTE.purple,
  MLP:      ORANGE,       // warm orange
  Theta:    PALETTE.slate,
  Ensemble: PALETTE.imperial,
};

export const FORECASTER_COLOURS: Record<string, string> = {
  ...FC_BASE,
  // Parameterised variants
  'EWMA(5)':      FC_BASE.EWMA,
  'ARIMA(2,1,1)': FC_BASE.ARIMA,
  'Neural Net':   FC_BASE.MLP,
  'Neural Net (MLP)': FC_BASE.MLP,
  'Ensemble (Naive+EWMA)': FC_BASE.Ensemble,
};

// ─── Behaviour scenario colour map ───────────────────────────────────
export const SCENARIO_COLOURS: Record<string, string> = {
  benign_baseline:     PALETTE.teal,
  bursty_kelly:        PALETTE.imperial,
  risk_averse_hedged:  PALETTE.slate,
  lumpy_miscalibrated: ORANGE,
  edge_threshold:      PALETTE.purple,
  sybil_split:         PALETTE.coral,
};

// ─── Behaviour family colour map ─────────────────────────────────────
export const FAMILY_COLORS: Record<string, string> = {
  participation: PALETTE.teal,
  information:   PALETTE.imperial,
  reporting:     PALETTE.purple,
  staking:       ORANGE,
  objectives:    PALETTE.navy,
  identity:      PALETTE.coral,
  learning:      PALETTE.teal,
  adversarial:   PALETTE.coral,
  operational:   PALETTE.slate,
};

// ─── Ordered agent palette (cycle-safe) ─────────────────────────────
// Matches the Python `PALETTE` list in plotting/style.py and the R
// `FORECASTER_COLOURS` vector in theme_thesis.R.
export const AGENT_COLORS = [
  PALETTE.navy,
  PALETTE.teal,
  PALETTE.coral,
  PALETTE.purple,
  ORANGE,
  PALETTE.slate,
  PALETTE.imperial,
  PALETTE.charcoal,
] as const;

// Cumulative CRPS line colours for the forecast-aggregation chart —
// named legacy keys kept so callers that imported `WEIGHTING_COLORS`
// don't need to change at the call site.
export const WEIGHTING_COLORS: Record<string, string> = {
  crpsUniform:        PALETTE.slate,
  crpsDeposit:        PALETTE.coral,
  crpsSkill:          PALETTE.purple,
  crpsMechanism:      PALETTE.teal,
  crpsBestSingle:     PALETTE.navy,
  crpsUniformCum:     PALETTE.slate,
  crpsDepositCum:     PALETTE.coral,
  crpsSkillCum:       PALETTE.purple,
  crpsMechanismCum:   PALETTE.teal,
  crpsBestSingleCum:  PALETTE.navy,
};

/** Primary accent colour for solitary charts with no legend. */
export const ACCENT = PALETTE.teal;

/** Muted fill used for zero-weight / inactive elements. */
export const MUTED = PALETTE.slate;

/** Neutral grid / axis line colour used across all Recharts charts. */
export const CHART_GRID   = PALETTE.border;
export const CHART_AXIS   = PALETTE.slate;
export const CHART_BORDER = PALETTE.border;

/**
 * Canonical tab10-derived ML-research colour register. Use these tokens in
 * any new chart that follows the thesis colour mapping (proposed mechanism /
 * post-processed / external / adversary / alt-reference / baseline / ink).
 */
export const THESIS_PALETTE = {
  proposed:      '#1F77B4', // blue — proposed mechanism
  postProcessed: '#FF7F0E', // orange — post-processed (dashed)
  external:      '#2CA02C', // green — external baseline (Vitali / Raja / operational)
  adversary:     '#D62728', // red — adversary
  altRef:        '#9467BD', // purple — alt reference
  baseline:      '#7F7F7F', // grey — uniform baseline
  ink:           '#1F2A38', // near-black — text and primary axis ink
} as const;

// ─── Contrast helpers (unchanged) ────────────────────────────────────

/** Parse a 3- or 6-digit hex colour string into [r, g, b] (0–255). */
function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace(/^#/, '');
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Convert an sRGB channel (0–255) to linear-light value (WCAG 2.1). */
function linearise(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a hex colour per WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRGB(hex);
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * WCAG 2.1 contrast ratio between two hex colours.
 *
 * @param fg Foreground colour hex (e.g. "#1B2A4A")
 * @param bg Background colour hex
 * @returns Contrast ratio in [1, 21]. ≥ 4.5 passes WCAG 2.1 AA for normal text.
 */
export function contrastRatio(fg: string, bg: string): number {
  const lFg = relativeLuminance(fg);
  const lBg = relativeLuminance(bg);
  const lighter = Math.max(lFg, lBg);
  const darker  = Math.min(lFg, lBg);
  return (lighter + 0.05) / (darker + 0.05);
}
