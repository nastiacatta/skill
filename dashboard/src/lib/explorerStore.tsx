/**
 * Explorer context: re-exposes the single app store for walkthrough/mechanism UI.
 * Use useStore() or useExplorer() — both read from the same source of truth.
 */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from './store';

export type { StoreState as ExplorerState } from './store';

const ExplorerContext = createContext<ReturnType<typeof useStore> | null>(null);

export function ExplorerProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  return (
    <ExplorerContext.Provider value={store}>
      {children}
    </ExplorerContext.Provider>
  );
}

export function useExplorer() {
  const ctx = useContext(ExplorerContext);
  if (!ctx) throw new Error('useExplorer must be used within ExplorerProvider');
  return ctx;
}
