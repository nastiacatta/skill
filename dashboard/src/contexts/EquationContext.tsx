/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useRef, type ReactNode } from 'react';
import type { NumberingContextValue } from '@/contexts/FigureContext';

const defaultValue: NumberingContextValue = {
  next: () => 0,
  reset: () => {},
};

export const EquationContext = createContext<NumberingContextValue>(defaultValue);

export function EquationProvider({ children }: { children: ReactNode }) {
  const counter = useRef(0);

  const next = useCallback(() => {
    counter.current += 1;
    return counter.current;
  }, []);

  const reset = useCallback(() => {
    counter.current = 0;
  }, []);

  return <EquationContext value={{ next, reset }}>{children}</EquationContext>;
}
