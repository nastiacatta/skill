import type { ReactNode } from 'react';

/**
 * Academic wrapper for analysis panels.
 *
 * Provides a consistent paper card surface with a serif header,
 * coloured accent rule, and optional right-side slot for badges or counts.
 */

export interface PanelShellProps {
  title: string;
  /** Accent colour for the left rule on the header. */
  accent?: string;
  /** Optional extra element rendered at the top-right of the header. */
  right?: ReactNode;
  /** Panel body. Not required when `emptyState` is supplied. */
  children?: ReactNode;
  /** Override card padding (default: 18). */
  padding?: number;
  /** When provided, renders an empty-state message instead of children. */
  emptyState?: string | null;
}

export function PanelShell({
  title,
  accent = 'var(--navy)',
  right,
  children,
  padding = 18,
  emptyState = null,
}: PanelShellProps) {
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h3
          className="font-serif flex items-center gap-2.5 tracking-tight"
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}
        >
          <span
            aria-hidden="true"
            className="inline-block"
            style={{ width: 3, height: 16, background: accent, borderRadius: 2 }}
          />
          {title}
        </h3>
        {right}
      </div>
      {emptyState ? (
        <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{emptyState}</p>
      ) : (
        children
      )}
    </div>
  );
}

export default PanelShell;
