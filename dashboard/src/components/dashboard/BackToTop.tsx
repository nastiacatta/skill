import { useEffect, useRef, useState, useCallback } from 'react';
import clsx from 'clsx';

/**
 * Floating "back to top" button that appears after the user has scrolled
 * past a threshold. Positioned above the sticky glossary button at the
 * bottom-right of the viewport.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLElement | Window>(window);

  useEffect(() => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('main .overflow-y-auto'));
    const target = candidates.find((el) => el.scrollHeight > el.clientHeight) ?? window;
    containerRef.current = target;

    const handler = () => {
      const scrollTop =
        target === window
          ? window.scrollY
          : (target as HTMLElement).scrollTop;
      setVisible(scrollTop > 320);
    };
    handler();
    target.addEventListener('scroll', handler, { passive: true });
    return () => target.removeEventListener('scroll', handler);
  }, []);

  const scrollToTop = useCallback(() => {
    const container = containerRef.current;
    if (container === window) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      (container as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      className={clsx(
        'no-print',
        'fixed bottom-20 right-5 z-40 w-10 h-10 rounded-full',
        'flex items-center justify-center transition-all duration-200',
        'hover:-translate-y-0.5 active:translate-y-0',
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none',
      )}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border-strong)',
        color: 'var(--ink-soft)',
        boxShadow: 'var(--shadow-md)',
      }}
      onMouseOver={(e) => {
        (e.currentTarget as HTMLElement).style.color = 'var(--navy)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--navy)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseOut={(e) => {
        (e.currentTarget as HTMLElement).style.color = 'var(--ink-soft)';
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 12V4M4 7.5L8 3.5L12 7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
