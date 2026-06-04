import { useRef, useCallback, useEffect, type KeyboardEvent } from 'react';
import clsx from 'clsx';

interface TabBarProps {
  /** Ordered list of tab labels */
  tabs: readonly string[];
  /** Currently active tab label */
  activeTab: string;
  /** Callback when a tab is activated */
  onTabChange: (tab: string) => void;
  /** Optional set of experiment-backed tab labels (renders status dots) */
  experimentTabs?: Set<string>;
  /** Optional progress label rendered right-aligned, e.g. "View 2 of 5: Accuracy" */
  progressLabel?: string;
  /**
   * Optional list of group break indices. A vertical separator is rendered
   * before the tab at each index. Useful for visually splitting tab groups.
   */
  groupBreaks?: number[];
}

/**
 * Academic tab bar — thin navy underline on the active tab, warm
 * low-contrast rule below the whole row, and a small navy-tinted dot
 * marking experiment-backed tabs (amber for taxonomy-only).
 */
export default function TabBar({
  tabs,
  activeTab,
  onTabChange,
  experimentTabs,
  progressLabel,
  groupBreaks,
}: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the active tab scrolled into view so no tab stays clipped off the
  // right edge of the scroll region on narrow viewports.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    if (active && typeof active.scrollIntoView === 'function') {
      active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [activeTab]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex === -1) return;

      let nextIndex: number | null = null;

      if (e.key === 'ArrowRight') { e.preventDefault(); nextIndex = (currentIndex + 1) % tabs.length; }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); nextIndex = (currentIndex - 1 + tabs.length) % tabs.length; }
      else if (e.key === 'Home') { e.preventDefault(); nextIndex = 0; }
      else if (e.key === 'End')  { e.preventDefault(); nextIndex = tabs.length - 1; }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const focused = document.activeElement;
        if (focused instanceof HTMLButtonElement && focused.dataset.tab) onTabChange(focused.dataset.tab);
        return;
      }

      if (nextIndex !== null) {
        const container = containerRef.current;
        if (!container) return;
        const buttons = container.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        const target = buttons[nextIndex];
        if (target) target.focus();
      }
    },
    [tabs, activeTab, onTabChange],
  );

  const breaks = new Set(groupBreaks ?? []);

  return (
    <div
      className="flex items-center"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div
        ref={containerRef}
        role="tablist"
        aria-label="Section tabs"
        className="tab-strip-scroll flex overflow-x-auto scrollbar-thin gap-0 min-w-0"
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, i) => {
          const isActive = tab === activeTab;
          const hasExperiment = experimentTabs?.has(tab);
          const showBreak = breaks.has(i);

          return (
            <span key={tab} className="flex items-center">
              {showBreak && (
                <span
                  aria-hidden="true"
                  className="inline-block w-px h-4 mx-2 self-center"
                  style={{ background: 'var(--border-strong)' }}
                />
              )}
              <button
                role="tab"
                data-tab={tab}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onTabChange(tab)}
                className={clsx(
                  'relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 transition-colors outline-none',
                  'focus-visible:ring-2 focus-visible:ring-offset-1 rounded-t-md',
                  'border-b-2 -mb-px',
                )}
                style={{
                  fontSize: 13.5,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--ink)' : 'var(--ink-soft)',
                  borderBottomColor: isActive ? 'var(--navy)' : 'transparent',
                  minHeight: 38,
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = 'var(--ink)';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(15, 23, 42, 0.03)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = 'var(--ink-soft)';
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }
                }}
              >
                {tab}
                {experimentTabs != null && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: hasExperiment ? 'var(--teal)' : 'var(--amber)' }}
                    aria-label={hasExperiment ? 'Experiment-backed' : 'Taxonomy only'}
                  />
                )}
              </button>
            </span>
          );
        })}
      </div>

      {progressLabel && (
        <span
          className="tab-strip-progress ml-auto flex-shrink-0 whitespace-nowrap pl-4 pr-1 font-medium"
          style={{ fontSize: 13, color: 'var(--ink-faint)' }}
        >
          {progressLabel}
        </span>
      )}
    </div>
  );
}
