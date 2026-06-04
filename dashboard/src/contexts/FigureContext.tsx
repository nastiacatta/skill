/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useRef, type ReactNode } from 'react';

/** Shared interface for sequential numbering contexts. */
export interface NumberingContextValue {
  /** Returns the next sequential number (1, 2, 3, …). */
  next(): number;
  /** Resets the counter to 0 so the next call to `next()` returns 1. */
  reset(): void;
}

const defaultValue: NumberingContextValue = {
  next: () => 0,
  reset: () => {},
};

export const FigureContext = createContext<NumberingContextValue>(defaultValue);

export function FigureProvider({ children }: { children: ReactNode }) {
  const counter = useRef(0);

  const next = useCallback(() => {
    counter.current += 1;
    return counter.current;
  }, []);

  const reset = useCallback(() => {
    counter.current = 0;
  }, []);

  return <FigureContext value={{ next, reset }}>{children}</FigureContext>;
}
