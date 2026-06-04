import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const SHORTCUTS = [
  {
    group: 'Zones',
    items: [
      { keys: ['t'], label: 'Toggle platform / research' },
    ],
  },
  {
    group: 'Navigation (this zone)',
    items: [
      { keys: ['1'], label: 'First rail item' },
      { keys: ['2'], label: 'Second rail item' },
      { keys: ['3'], label: 'Third rail item' },
      { keys: ['4'], label: 'Fourth rail item' },
      { keys: ['5'], label: 'Fifth rail item' },
      { keys: ['6'], label: 'Sixth rail item' },
    ],
  },
  {
    group: 'Tools',
    items: [
      { keys: ['g'], label: 'Toggle symbol glossary' },
      { keys: ['?'], label: 'Show this panel' },
      { keys: ['Esc'], label: 'Close overlays' },
    ],
  },
  {
    group: 'Tabs',
    items: [
      { keys: ['←', '→'], label: 'Move focus between tabs' },
      { keys: ['Home'], label: 'First tab' },
      { keys: ['End'], label: 'Last tab' },
      { keys: ['Enter'], label: 'Activate focused tab' },
    ],
  },
] as const;

function Kbd({ children }: { children: string }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md text-[11px] font-mono font-semibold"
      style={{
        border: '1px solid var(--border-strong)',
        background: 'linear-gradient(to bottom, var(--card), var(--paper))',
        color: 'var(--ink-muted)',
        boxShadow: '0 1px 0 rgba(15, 23, 42, 0.04), inset 0 -1px 0 rgba(15, 23, 42, 0.06)',
      }}
    >
      {children}
    </kbd>
  );
}

/**
 * Keyboard shortcuts overlay. Triggered by pressing `?` (shift+/).
 * Ignores input/textarea/select focus to avoid interfering with typing.
 */
export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6 animate-in fade-in duration-150"
      style={{
        background: 'rgba(11, 18, 32, 0.35)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden animate-in zoom-in-95 duration-150"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block w-1 h-4 rounded"
              style={{ background: 'var(--navy)' }}
            />
            <h3
              className="font-semibold"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 16,
                color: 'var(--ink)',
              }}
            >
              Keyboard shortcuts
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md transition-colors w-8 h-8 inline-flex items-center justify-center text-lg leading-none"
            style={{ color: 'var(--ink-faint)' }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--ink)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(15, 23, 42, 0.05)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--ink-faint)';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <div className="p-5 space-y-5">
          {SHORTCUTS.map((section) => (
            <div key={section.group}>
              <p
                className="text-[10px] font-semibold uppercase mb-2"
                style={{ letterSpacing: '0.14em', color: 'var(--ink-faint)' }}
              >
                {section.group}
              </p>
              <dl className="space-y-1.5">
                {section.items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 py-1">
                    <dd
                      className="text-sm"
                      style={{ color: 'var(--ink-muted)' }}
                    >
                      {item.label}
                    </dd>
                    <dt className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && (
                            <span className="text-[10px]" style={{ color: 'var(--ink-faint)' }}>
                              +
                            </span>
                          )}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </dt>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <div
          className="px-5 py-2.5 text-[11px] flex items-center justify-between"
          style={{
            borderTop: '1px solid var(--border)',
            background: 'var(--paper)',
            color: 'var(--ink-soft)',
          }}
        >
          <span>
            Press <Kbd>?</Kbd> to toggle
          </span>
          <span>
            <Kbd>Esc</Kbd> to close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
