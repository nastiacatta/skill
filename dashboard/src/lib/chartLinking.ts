/**
 * Pure helper for chart linking opacity — extracted from ChartLinkingContext
 * to satisfy react-refresh/only-export-components (contexts and non-component
 * exports must live in separate files).
 */

/**
 * Compute the visual opacity for a method series.
 *
 * - Returns 0   if `key` is not in `visibleMethods`
 * - Returns 1.0 if `key === hoveredMethod`
 * - Returns 0.2 if another method is hovered (key ≠ hoveredMethod) but key is visible
 * - Returns 0.9 if nothing is hovered and key is visible
 */
export function getMethodOpacity(
  key: string,
  hoveredMethod: string | null,
  visibleMethods: Set<string>,
): number {
  if (!visibleMethods.has(key)) return 0;
  if (hoveredMethod === key) return 1.0;
  if (hoveredMethod !== null) return 0.2;
  return 0.9;
}
