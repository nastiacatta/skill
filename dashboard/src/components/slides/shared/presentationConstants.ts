import type React from 'react';

/**
 * Clean academic palette — single source of truth for all presentation colours.
 * Every colour used in text, SVG fills, or chart data series must come from this set.
 *
 * The constant itself now lives in the design-system layer (`@/lib/palette`)
 * so the eager shell never pulls this presentation module onto the first-paint
 * path. It is re-exported here so existing slide call sites are unchanged.
 */
export { PALETTE } from '@/lib/palette';

/**
 * Typography tokens for consistent font sizing and spacing across all slides.
 */
export const TYPOGRAPHY = {
  fontFamily: "'Avenir Next', 'Avenir', -apple-system, BlinkMacSystemFont, sans-serif",
  heading: { fontSize: '3.35rem', fontWeight: 700, lineHeight: 1.12 },
  body: { fontSize: '1.8rem', lineHeight: 2.05, marginBottom: '16px' },
  bodySplit: { fontSize: '1.75rem', lineHeight: 1.92, marginBottom: '14px' },
  bodyContent: { fontSize: '1.9rem', lineHeight: 2.05, marginBottom: '16px' },
  chartTitle: { fontSize: '24px', fontWeight: 700 },
  chartAxis: { fontSize: '18px' },
  chartDataLabel: { fontSize: '19px', fontWeight: 600 },
} as const;

/** Outer padding for SlideShell and PresentationPage content/split layouts */
export const SLIDE_PAGE_PADDING: React.CSSProperties = {
  padding: '56px 64px',
  paddingTop: '60px',
};

/**
 * Framed panel for diagrams on split slides — improves separation from bullets.
 */
export const DIAGRAM_PANEL: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#FFFFFF',
  borderRadius: 16,
  border: '1.5px solid #E2E8F0',
  boxShadow: '0 4px 28px rgba(27, 42, 74, 0.09)',
  padding: '22px 26px',
};

/**
 * Framed figure area for full-width slides (PNG from R).
 */
export const FIGURE_FRAME: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 14,
  border: '1.5px solid #E2E8F0',
  boxShadow: '0 4px 24px rgba(27, 42, 74, 0.07)',
  padding: '16px 20px',
};

/** Numbered slides in the main deck (excludes appendix backup slide). */
export const MAIN_DECK_SLIDE_COUNT = 13 as const;

/**
 * Emphasis style mappings for inline text highlighting within bullet items.
 */
export const EMPHASIS: Record<'result' | 'method' | 'warning' | 'numeric', React.CSSProperties> = {
  result: { color: '#2E8B8B', fontWeight: 700 },
  method: { color: '#1B2A4A', fontWeight: 700 },
  warning: { color: '#E85D4A', fontWeight: 600 },
  numeric: { color: '#2D3748', fontWeight: 700 },
} as const;

/**
 * Dark gradient used for section/dark slide backgrounds.
 */
export const DARK_GRADIENT = 'linear-gradient(135deg, #1B2A4A 0%, #0F172A 100%)' as const;

/**
 * Section bar height — thicker for visual impact.
 */
export const SECTION_BAR_HEIGHT = 6;

/**
 * Consistent card styling tokens used across all slides.
 */
export const CARD_STYLE: React.CSSProperties = {
  borderRadius: 14,
  border: `1.5px solid #CBD5E1`,
  background: '#FFFFFF',
  boxShadow: '0 4px 20px rgba(27, 42, 74, 0.06)',
  padding: '24px 28px',
};

/**
 * Section definitions for the presentation flow.
 * 13-slide narrative: Mechanism Comparison moved to appendix.
 */
export const SECTIONS = {
  PROBLEM:    { label: 'PROBLEM',    colour: '#003E74',    slides: [1, 2, 3, 4, 5] },
  SOLUTION:   { label: 'SOLUTION',   colour: '#2E8B8B',    slides: [6, 7, 8] },
  VALIDATION: { label: 'VALIDATION', colour: '#7C3AED',    slides: [9, 10, 11, 12] },
  CLOSING:    { label: '',           colour: 'transparent', slides: [13] },
} as const;

/** Get section info for a given slide number */
export function getSectionForSlide(slideNumber: number): { label: string; colour: string } {
  if (slideNumber >= 1 && slideNumber <= 5) return SECTIONS.PROBLEM;
  if (slideNumber >= 6 && slideNumber <= 8) return SECTIONS.SOLUTION;
  if (slideNumber >= 9 && slideNumber <= 12) return SECTIONS.VALIDATION;
  return SECTIONS.CLOSING;
}
