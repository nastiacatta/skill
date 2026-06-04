import { useContext } from 'react';
import {
  ChartLinkingContext,
  type ChartLinkingContextValue,
} from '@/contexts/ChartLinkingContext';

/**
 * Consumer hook for the cross-chart linking context.
 *
 * Returns the full `ChartLinkingContextValue` — state (hoveredMethod,
 * visibleMethods, hoveredRound) plus actions (setHoveredMethod,
 * toggleMethod, setHoveredRound, resetFilters).
 */
export function useChartLinking(): ChartLinkingContextValue {
  return useContext(ChartLinkingContext);
}
