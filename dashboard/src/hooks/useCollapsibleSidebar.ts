import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'sidebar-collapsed';
const COLLAPSED_WIDTH = 48;
const EXPANDED_WIDTH = 200;
const HOVER_EXPAND_DELAY = 300;

export interface CollapsibleSidebarState {
  isCollapsed: boolean;
  isHoverExpanded: boolean;
  effectiveWidth: number;
  toggle(): void;
  onMouseEnter(): void;
  onMouseLeave(): void;
}

/** Read the persisted collapsed state from localStorage. */
function readPersistedState(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return false; // default: expanded
    return stored === 'true';
  } catch {
    // localStorage unavailable (e.g. private browsing) — default to expanded
    return false;
  }
}

/** Write the collapsed state to localStorage. */
function writePersistedState(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // Silently ignore — persistence is best-effort
  }
}

/**
 * Manages collapsible sidebar state with localStorage persistence
 * and hover-to-expand behaviour.
 *
 * - `isCollapsed`: whether the sidebar is in collapsed (icon-only) mode
 * - `isHoverExpanded`: whether the sidebar is temporarily expanded on hover
 * - `effectiveWidth`: 48px when collapsed (and not hover-expanded), 200px otherwise
 * - `toggle()`: flips `isCollapsed` and persists to localStorage
 * - `onMouseEnter` / `onMouseLeave`: hover handlers with 300ms expand delay
 */
export function useCollapsibleSidebar(): CollapsibleSidebarState {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(readPersistedState);
  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up any pending timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current !== null) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      writePersistedState(next);
      return next;
    });
    // Clear hover state when toggling manually
    setIsHoverExpanded(false);
    if (hoverTimeoutRef.current !== null) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const onMouseEnter = useCallback(() => {
    if (!isCollapsed) return; // Only relevant when collapsed
    // Clear any pending leave timeout
    if (hoverTimeoutRef.current !== null) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoverExpanded(true);
      hoverTimeoutRef.current = null;
    }, HOVER_EXPAND_DELAY);
  }, [isCollapsed]);

  const onMouseLeave = useCallback(() => {
    // Clear any pending expand timeout
    if (hoverTimeoutRef.current !== null) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    // Collapse immediately on mouse leave
    setIsHoverExpanded(false);
  }, []);

  const effectiveWidth =
    isCollapsed && !isHoverExpanded ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return {
    isCollapsed,
    isHoverExpanded,
    effectiveWidth,
    toggle,
    onMouseEnter,
    onMouseLeave,
  };
}
