import { useState, useRef, useEffect } from 'react';
import { storyPalette } from './storyPalette';

const KEYBINDINGS: [string, string][] = [
  ['ArrowRight', 'Next step'],
  ['ArrowLeft', 'Previous step'],
  ['ArrowDown', 'Next round'],
  ['ArrowUp', 'Previous round'],
  ['Space', 'Play / pause'],
  ['Home', 'Restart round'],
  ['1 - 6', 'Pin forecaster'],
  ['Esc', 'Unpin'],
];

export default function StoryKeyboardHelp() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Keyboard shortcuts"
        aria-expanded={open}
        aria-haspopup="true"
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          background: 'transparent',
          border: `1px solid ${storyPalette.surface.border}`,
          color: storyPalette.text.muted,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          transition: 'border-color 0.15s ease',
        }}
      >
        ?
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Keyboard shortcuts"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: storyPalette.surface.tile,
            border: `1px solid ${storyPalette.surface.border}`,
            borderRadius: 8,
            padding: '12px 16px',
            boxShadow: '0 4px 20px rgba(27, 42, 74, 0.12)',
            zIndex: 100,
            minWidth: 200,
          }}
        >
          <p
            style={{
              margin: '0 0 8px',
              fontSize: 12,
              fontWeight: 600,
              color: storyPalette.text.body,
              fontFamily: 'var(--font-sans)',
            }}
          >
            Keyboard shortcuts
          </p>
          <dl style={{ margin: 0 }}>
            {KEYBINDINGS.map(([key, desc]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '3px 0',
                  gap: 16,
                }}
              >
                <kbd
                  style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    background: storyPalette.pool.fill,
                    border: `1px solid ${storyPalette.surface.border}`,
                    borderRadius: 4,
                    padding: '1px 6px',
                    color: storyPalette.text.body,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {key}
                </kbd>
                <span
                  style={{
                    fontSize: 11,
                    color: storyPalette.text.muted,
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {desc}
                </span>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
