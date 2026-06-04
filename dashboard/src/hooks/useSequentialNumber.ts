import { useContext, useState, type Context } from 'react';
import type { NumberingContextValue } from '@/contexts/FigureContext';
import { FigureContext } from '@/contexts/FigureContext';
import { EquationContext } from '@/contexts/EquationContext';

/**
 * Calls `ctx.next()` exactly once on mount and returns a stable number.
 *
 * Uses `useState` with a lazy initializer so the number is assigned once
 * and remains stable across re-renders.
 */
export function useSequentialNumber(ctx: Context<NumberingContextValue>): number {
  const numbering = useContext(ctx);
  const [num] = useState(() => numbering.next());
  return num;
}

/** Convenience wrapper — returns the next figure number. */
export function useFigureNumber(): number {
  return useSequentialNumber(FigureContext);
}

/** Convenience wrapper — returns the next equation number. */
export function useEquationNumber(): number {
  return useSequentialNumber(EquationContext);
}
