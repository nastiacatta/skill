import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/platform/ui';

interface ShareLinkButtonProps {
  /**
   * Optional hook run before the URL is copied, e.g. to write the current
   * round into the query string so the copied link restores it. Returns the
   * URL to copy, or void to copy `window.location.href` as-is.
   */
  onBeforeCopy?: () => string | void;
  /** Trigger label. Defaults to 'Link to this view'. */
  label?: string;
}

type Status = 'idle' | 'copied' | 'ready';

/**
 * A small ghost button that copies the current view URL to the clipboard so a
 * viewer can share the exact tab, round, or panel they are looking at. On
 * success the label briefly swaps to "Link copied". Where the clipboard API is
 * unavailable the button still leaves the shareable link in the address bar and
 * reads "Link ready".
 *
 * Imported only by lazy route pages, so it never reaches the eager bundle. No
 * toast library: the in-button label swap is the only feedback.
 */
export default function ShareLinkButton({
  onBeforeCopy,
  label = 'Link to this view',
}: ShareLinkButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((next: Status) => {
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 1600);
  }, []);

  const handleClick = useCallback(() => {
    const overrideHref = onBeforeCopy?.();
    const href =
      typeof overrideHref === 'string'
        ? overrideHref
        : typeof window !== 'undefined'
          ? window.location.href
          : '';

    const clip =
      typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (clip && typeof clip.writeText === 'function') {
      clip.writeText(href).then(
        () => flash('copied'),
        () => flash('ready'),
      );
    } else {
      // No clipboard: the URL is already in the address bar (the deep-link
      // setter ran), so the link is shareable. Signal that rather than failing.
      flash('ready');
    }
  }, [onBeforeCopy, flash]);

  const text =
    status === 'copied' ? 'Link copied' : status === 'ready' ? 'Link ready' : label;

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} aria-live="polite">
      {text}
    </Button>
  );
}
