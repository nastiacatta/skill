import { useEffect, useState } from 'react';
import { RADIUS, SPACE, TYPE } from '@/components/platform/designTokens';
import { useIsSmallScreen } from '@/hooks/useMediaQuery';

/**
 * A calm, dismissible banner shown on phone and tablet viewports (narrower
 * than the `tablet` breakpoint, 768px). It tells the visitor the dashboard
 * is built for a laptop screen and offers a "continue anyway" action, so the
 * notice is informational and never a hard block: every view stays reachable
 * underneath it.
 *
 * Dismissal is remembered for the browser session (`sessionStorage`), so the
 * banner does not reappear on every route change. It is not stored
 * permanently, so a fresh session surfaces the laptop hint once more.
 */
export const NOTICE_STORAGE_KEY = 'sx-small-screen-notice-dismissed';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(NOTICE_STORAGE_KEY) === '1';
  } catch {
    // Private-mode or storage-disabled browsers: treat as not dismissed and
    // never throw. The banner simply shows for the session.
    return false;
  }
}

export default function SmallScreenNotice() {
  const isSmall = useIsSmallScreen();
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);

  // Re-read the stored flag whenever the layout crosses into small-screen
  // territory, so a visitor who rotates a tablet or resizes a window sees
  // the same dismissal state the session already holds.
  useEffect(() => {
    if (isSmall) setDismissed(readDismissed());
  }, [isSmall]);

  if (!isSmall || dismissed) return null;

  const onDismiss = () => {
    try {
      sessionStorage.setItem(NOTICE_STORAGE_KEY, '1');
    } catch {
      // Ignore storage failures; the banner will reappear next mount, which
      // is acceptable degradation when storage is unavailable.
    }
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="small-screen-notice"
      className="no-print"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: SPACE[3],
        padding: `${SPACE[3]}px ${SPACE[4]}px`,
        background: 'var(--navy-tint)',
        borderBottom: '1px solid var(--border)',
        color: 'var(--ink-muted)',
        fontFamily: 'var(--font-sans)',
        fontSize: TYPE.caption.size,
        lineHeight: 1.45,
      }}
    >
      <p style={{ margin: 0, flex: 1 }}>
        This dashboard is built for a laptop screen. On a phone the larger
        charts scroll sideways or simplify. For the full view, open it on a
        laptop. You can keep going here.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        data-testid="small-screen-notice-dismiss"
        style={{
          flexShrink: 0,
          minHeight: 44,
          minWidth: 44,
          padding: `0 ${SPACE[3]}px`,
          borderRadius: RADIUS.sm,
          border: '1px solid var(--border-strong)',
          background: 'var(--paper)',
          color: 'var(--ink)',
          fontFamily: 'var(--font-sans)',
          fontSize: TYPE.label.size,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Continue
      </button>
    </div>
  );
}
