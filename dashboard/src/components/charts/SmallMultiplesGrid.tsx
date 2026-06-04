import type { ReactNode } from 'react';

/* ── Types ─────────────────────────────────────────────────────────── */

interface SmallMultiplesGridProps {
  children: ReactNode;
  /** Optional title above the grid */
  title?: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Optional additional CSS class */
  className?: string;
}

/* ── Component ─────────────────────────────────────────────────────── */

/**
 * CSS Grid wrapper for rendering small-multiple charts.
 *
 * Lays out children in a responsive grid using
 * `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`.
 * Each child occupies one grid cell.
 */
export default function SmallMultiplesGrid({
  children,
  title,
  subtitle,
  className = '',
}: SmallMultiplesGridProps) {
  return (
    <div className={className}>
      {(title || subtitle) && (
        <div className="mb-3">
          {title && (
            <h3
              className="font-semibold text-slate-800"
              style={{ fontSize: '14px', lineHeight: '20px' }}
            >
              {title}
            </h3>
          )}
          {subtitle && (
            <p
              className="text-slate-500 mt-0.5"
              style={{ fontSize: '12px', lineHeight: '16px' }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {children}
      </div>
    </div>
  );
}
