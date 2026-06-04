import type { ReactNode } from 'react';

/**
 * Keeps a large, maths-correct SVG chart legible on phone and tablet widths.
 *
 * The platform's big charts (the market floor, the forecast composer fan)
 * draw into a fixed ~960px viewBox and stretch to `width: 100%`. On a laptop
 * that is fine. On a 360px phone the same viewBox scales down until the axis
 * labels, the median line, and the realised-outcome mark are too small to
 * read, and a scaled-down fan stops reading as a fan.
 *
 * Rather than redraw the maths at a second scale (which risks the two
 * renderings disagreeing), this wrapper gives the chart a legible minimum
 * width on small screens and lets the container scroll sideways. The fan
 * still reads as a fan, the axes keep their labels, and the aggregate and
 * outcome marks stay distinguishable, because nothing about the drawing
 * changes, only the viewport onto it. A caption tells the visitor the chart
 * scrolls. At/above the tablet breakpoint the wrapper is inert: the chart
 * fills the column as before. All breakpoint and scroll behaviour lives in
 * `index.css` (`.chart-scroller`), so the widths are not duplicated here.
 */
export interface ChartScrollerProps {
  children: ReactNode;
  /** Accessible label for the scroll region. */
  label?: string;
  className?: string;
}

export default function ChartScroller({ children, label, className = '' }: ChartScrollerProps) {
  return (
    <div className={`chart-scroller ${className}`.trim()} data-testid="chart-scroller">
      <div
        className="chart-scroller__viewport"
        role="region"
        aria-label={label}
        tabIndex={0}
      >
        {children}
      </div>
      <p className="chart-scroller__hint" aria-hidden="true">
        Scroll sideways to see the full chart
      </p>
    </div>
  );
}
