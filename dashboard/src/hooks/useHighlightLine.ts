import { useState, useCallback } from 'react';

/**
 * Manages legend-hover highlighting for Recharts line charts.
 *
 * Usage:
 *   const { hoveredKey, setHoveredKey, getOpacity } = useHighlightLine();
 *   <Legend onMouseEnter={e => setHoveredKey(e.dataKey)} onMouseLeave={() => setHoveredKey(null)} />
 *   <Line strokeOpacity={getOpacity('equal')} ... />
 */
export function useHighlightLine() {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const getOpacity = useCallback(
    (key: string): number =>
      hoveredKey == null ? 0.9 : hoveredKey === key ? 1.0 : 0.2,
    [hoveredKey],
  );

  return { hoveredKey, setHoveredKey, getOpacity } as const;
}
