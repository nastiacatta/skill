import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { GLOSSARY_ENTRIES } from '@/lib/tokens';

/**
 * Floating symbol glossary — warm paper surface, serif symbol column.
 * Toggle with the 'g' key.
 */
export default function StickyGlossary() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'g') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) setFilter('');
      return !prev;
    });
  }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return GLOSSARY_ENTRIES;
    const q = filter.toLowerCase();
    return GLOSSARY_ENTRIES.filter(
      (e) =>
        e.symbol.toLowerCase().includes(q) ||
        e.meaning.toLowerCase().includes(q),
    );
  }, [filter]);

  return (
    <div className="fixed bottom-5 right-5 z-50 no-print">
      {open && (
        <div
          className="mb-2 w-80 max-h-[70vh] flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <h4
              className="eyebrow"
              style={{ color: 'var(--navy)', fontSize: 11 }}
            >
              Symbol glossary
            </h4>
            <button
              onClick={toggle}
              className="transition-colors w-6 h-6 inline-flex items-center justify-center text-sm leading-none rounded-md"
              aria-label="Close glossary"
              style={{ color: 'var(--ink-faint)' }}
            >
              ✕
            </button>
          </div>

          <div className="px-4 pb-2">
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search symbols…"
              className="w-full px-2.5 py-1.5 focus:outline-none transition-colors"
              style={{
                fontSize: 13,
                border: '1px solid var(--border)',
                background: 'var(--cream)',
                color: 'var(--ink)',
                borderRadius: 4,
              }}
            />
          </div>

          <div className="overflow-y-auto scrollbar-thin px-4 pb-3 flex-1">
            {filtered.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--ink-faint)', padding: '8px 0' }}>
                No matches
              </p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                {filtered.map(({ symbol, meaning }) => (
                  <span key={symbol} className="contents">
                    <dt
                      className="font-serif"
                      style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}
                    >
                      {symbol}
                    </dt>
                    <dd
                      style={{ fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.5 }}
                    >
                      {meaning}
                    </dd>
                  </span>
                ))}
              </dl>
            )}
          </div>

          <div
            className="px-4 py-2"
            style={{
              borderTop: '1px solid var(--border)',
              fontSize: 10.5,
              color: 'var(--ink-faint)',
            }}
          >
            Press{' '}
            <kbd
              className="font-mono rounded px-1.5"
              style={{ background: 'var(--cream)', border: '1px solid var(--border)' }}
            >g</kbd>{' '}
            to toggle &middot;{' '}
            <kbd
              className="font-mono rounded px-1.5"
              style={{ background: 'var(--cream)', border: '1px solid var(--border)' }}
            >esc</kbd>{' '}
            to close
          </div>
        </div>
      )}
      <button
        onClick={toggle}
        className={clsx(
          'w-11 h-11 font-serif text-white transition-all duration-200 flex items-center justify-center',
          'hover:-translate-y-0.5 active:translate-y-0',
          open && 'rotate-180',
        )}
        title="Symbol glossary (g)"
        aria-label="Toggle symbol glossary"
        aria-expanded={open}
        style={{
          background: 'var(--navy)',
          borderRadius: '50%',
          fontSize: 20,
          fontWeight: 600,
          boxShadow: '0 6px 20px -4px rgba(15, 31, 61, 0.35)',
        }}
      >
        &Sigma;
      </button>
    </div>
  );
}
