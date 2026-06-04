/**
 * WCAG 2.1 contrast utilities for enforcing accessibility compliance
 * across the presentation system.
 */

/**
 * Convert a hex colour string to its relative luminance per WCAG 2.1.
 * Formula: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(hex: string): number {
  const sanitised = hex.replace('#', '');
  const r = parseInt(sanitised.slice(0, 2), 16) / 255;
  const g = parseInt(sanitised.slice(2, 4), 16) / 255;
  const b = parseInt(sanitised.slice(4, 6), 16) / 255;

  const linearise = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * Compute the WCAG 2.1 contrast ratio between two hex colours.
 * Returns a value between 1 and 21.
 */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check whether a foreground/background pair meets WCAG AA for normal text (≥ 4.5:1).
 */
export function meetsWCAG_AA(fg: string, bg: string): boolean {
  return contrastRatio(fg, bg) >= 4.5;
}

/** Permitted text colours on light backgrounds (#F7FAFC, #FFFFFF) */
const PERMITTED_ON_LIGHT = ['#002147', '#1A202C', '#4A5568', '#C53030', '#00847F'] as const;

/** Permitted text colours on dark backgrounds (#002147, #1a1a2e) */
const PERMITTED_ON_DARK = ['#FFFFFF', '#E2E8F0', '#FFFBF0', '#00847F'] as const;

/**
 * Check whether a colour is in the permitted set for the given background type.
 */
export function isPermittedColour(colour: string, background: 'light' | 'dark'): boolean {
  const upper = colour.toUpperCase();
  if (background === 'light') {
    return PERMITTED_ON_LIGHT.some((c) => c.toUpperCase() === upper);
  }
  return PERMITTED_ON_DARK.some((c) => c.toUpperCase() === upper);
}

/**
 * Extract the alpha value from an rgba() colour string.
 * Returns null if the string is not in rgba format.
 */
export function parseRgbaAlpha(colour: string): number | null {
  const match = colour.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
  if (!match) return null;
  return parseFloat(match[1]);
}
