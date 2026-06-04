import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  /**
   * Layout width. Kept for backwards-compatibility with existing call sites,
   * but every page now renders at the same max-width so side margins stay
   * consistent across the app. Pass either value — they resolve identically.
   */
  width?: 'narrow' | 'wide';
  className?: string;
}

/**
 * Consistent page shell used by every top-level page in the main app.
 *
 *  - Uniform horizontal padding: 24px on small, 40px on ≥sm
 *  - Uniform vertical rhythm:    48px top, 80px bottom, 48px between sections
 *  - Single canonical max-width  so every page has matching side margins
 *
 * Presentation slides have their own design system and do not use this shell.
 */
export default function PageShell({
  children,
  width: _width = 'wide',
  className = '',
}: PageShellProps) {
  // Single unified width. Previously narrow = 960, wide = 1360, which produced
  // visibly different side margins (~320px vs ~120px on a 1600px viewport).
  // 1200px is a compromise: generous breathing room like the old "narrow"
  // pages, while still wide enough for the data-dense grids.
  void _width;
  return (
    <div className="flex-1 overflow-y-auto">
      <div
        className={`max-w-[1200px] mx-auto px-6 sm:px-10 pt-12 pb-20 space-y-12 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
