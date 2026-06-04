import { useState, useRef, useEffect } from 'react';
import MathBlock from '@/components/dashboard/MathBlock';

export interface InfoToggleContent {
  term: string;
  definition: string;
  interpretation: string;
  latex?: string;
  axes?: { x: string; y: string };
}

interface InfoToggleProps extends InfoToggleContent {
  /** Additional class name for the wrapper span. */
  className?: string;
}

/**
 * Small "i" info affordance with a compact academic popover.
 */
export default function InfoToggle({
  term,
  definition,
  interpretation,
  latex,
  axes,
}: InfoToggleProps) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        popRef.current?.contains(e.target as Node) ||
        btnRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full transition-colors shrink-0"
        title={`What is ${term}?`}
        aria-label={`Help: ${term}`}
        aria-expanded={open}
        style={{
          color: open ? 'var(--navy)' : 'var(--ink-faint)',
          background: open ? 'var(--navy-tint)' : 'transparent',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700 }}>i</span>
      </button>
      {open && (
        <div
          ref={popRef}
          className="absolute left-0 top-full mt-1.5 z-50 w-72 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-top-1 duration-150"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            padding: 16,
            boxShadow: 'var(--shadow-lg)',
          }}
          role="dialog"
          aria-label={`Definition: ${term}`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h5
              className="font-serif"
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}
            >
              {term}
            </h5>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded w-5 h-5 inline-flex items-center justify-center text-sm shrink-0 transition-colors"
              aria-label="Close"
              style={{ color: 'var(--ink-faint)' }}
            >
              ✕
            </button>
          </div>
          {latex && (
            <div
              className="mb-3 p-2.5 overflow-x-auto text-base [&_.katex]:text-[1.0625rem]"
              style={{
                background: 'var(--cream)',
                border: '1px solid var(--border)',
                borderRadius: 4,
              }}
            >
              <MathBlock latex={latex} inline />
            </div>
          )}
          <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.55, marginBottom: 6 }}>
            <strong style={{ color: 'var(--ink)' }}>Meaning.</strong> {definition}
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.55, marginBottom: 6 }}>
            <strong style={{ color: 'var(--ink)' }}>Interpretation.</strong> {interpretation}
          </p>
          {axes && (
            <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              <strong style={{ color: 'var(--ink-muted)' }}>Axes.</strong> x = {axes.x}, y = {axes.y}
            </p>
          )}
        </div>
      )}
    </span>
  );
}
