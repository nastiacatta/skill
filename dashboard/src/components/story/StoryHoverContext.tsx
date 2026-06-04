import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

interface StoryHoverState {
  hoveredForecaster: number | null;
  pinnedForecaster: number | null;
  activeForecaster: number | null;
  setHoveredForecaster: (index: number | null) => void;
  setPinnedForecaster: (index: number | null) => void;
  togglePin: (index: number) => void;
  clearPin: () => void;
}

const StoryHoverContext = createContext<StoryHoverState>({
  hoveredForecaster: null,
  pinnedForecaster: null,
  activeForecaster: null,
  setHoveredForecaster: () => {},
  setPinnedForecaster: () => {},
  togglePin: () => {},
  clearPin: () => {},
});

export function StoryHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredForecaster, setHoveredRaw] = useState<number | null>(null);
  const [pinnedForecaster, setPinnedRaw] = useState<number | null>(null);

  const setHoveredForecaster = useCallback((index: number | null) => {
    setHoveredRaw(index);
  }, []);

  const setPinnedForecaster = useCallback((index: number | null) => {
    setPinnedRaw(index);
  }, []);

  const togglePin = useCallback((index: number) => {
    setPinnedRaw((prev) => (prev === index ? null : index));
  }, []);

  const clearPin = useCallback(() => {
    setPinnedRaw(null);
  }, []);

  const activeForecaster = hoveredForecaster ?? pinnedForecaster;

  const value = useMemo(
    () => ({
      hoveredForecaster,
      pinnedForecaster,
      activeForecaster,
      setHoveredForecaster,
      setPinnedForecaster,
      togglePin,
      clearPin,
    }),
    [hoveredForecaster, pinnedForecaster, activeForecaster, setHoveredForecaster, setPinnedForecaster, togglePin, clearPin],
  );

  return (
    <StoryHoverContext.Provider value={value}>
      {children}
    </StoryHoverContext.Provider>
  );
}

export function useStoryHover(): StoryHoverState {
  return useContext(StoryHoverContext);
}
