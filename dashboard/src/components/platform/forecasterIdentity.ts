/**
 * Stable colour + label identity for synthetic-panel forecasters.
 *
 * Reuses the canonical `AGENT_COLORS` cycle (palette.ts) so a forecaster keeps
 * its hue across every platform view, exactly as the design system mandates
 * (design_system.md §2: reuse the maps, never re-key). Slot 0 is the visitor
 * when the "be a forecaster" game is in play.
 */
import { AGENT_COLORS } from '@/lib/palette';

export function forecasterColour(index: number): string {
  return AGENT_COLORS[index % AGENT_COLORS.length];
}

/** Panel label F1, F2, ... ; the visitor is "You" when flagged. */
export function forecasterLabel(index: number, visitorIndex?: number): string {
  if (visitorIndex != null && index === visitorIndex) return 'You';
  return `F${index + 1}`;
}
