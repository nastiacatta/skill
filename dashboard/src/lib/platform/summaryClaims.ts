/**
 * Read-only helpers over the provenance registry for the printable summary.
 *
 * These live in `lib/platform` (light content) rather than in the registry
 * itself: the registry is the contracted source of truth, and this module only
 * reads from it. Nothing here invents or re-derives a number. Both helpers are
 * pure, so the summary page can surface registry figures by id and format them
 * the one agreed way, never hand-typing a value.
 */

import { PROVENANCE_CLAIMS, type ProvenanceClaim } from '@/lib/provenance';

/** Look a claim up by its stable id (C1, C3-lower, ...). */
export function claimById(id: string): ProvenanceClaim | undefined {
  return PROVENANCE_CLAIMS.find((c) => c.id === id);
}

/**
 * Format a claim's `expected` value for display, appending the unit hint.
 * Integers print whole (grouped), percentages to two decimals, everything else
 * to four. This is the single shared formatter so every surface that shows a
 * registry number renders it identically.
 */
export function formatClaimValue(claim: ProvenanceClaim): string {
  const { expected, unit } = claim;
  const body = Number.isInteger(expected)
    ? expected.toLocaleString('en-GB')
    : expected.toFixed(unit === '%' ? 2 : 4);
  return unit ? `${body} ${unit}` : body;
}
