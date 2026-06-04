import { useState, type ReactNode } from 'react';
import { SPACE, RADIUS, TYPE } from '@/components/platform/designTokens';

export interface HowToReadProps {
  /** Stable key for the session-dismiss, e.g. 'evidence-delta'. */
  id: string;
  /** Trigger label. Defaults to 'How to read this'. */
  title?: string;
  /** Two to three plain-language sentences, rendered as list items. */
  points: string[];
  /** Optional maths node, revealed by a nested toggle. Pass only where the page already shows the formula. */
  maths?: ReactNode;
}

const STORAGE_PREFIX = 'howToRead:';

/** Read a sessionStorage flag, guarded for SSR and test environments. */
function isDismissed(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(STORAGE_PREFIX + id) === '1';
  } catch {
    return false;
  }
}

/** Write the session-dismiss flag, guarded. */
function persistDismiss(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + id, '1');
  } catch {
    // Storage unavailable (private mode, test env): dismiss for this render only.
  }
}

/**
 * A quiet, dismissible reading guide that sits under a chart heading. The
 * trigger line is collapsed by default. Expanding it reveals two to three
 * plain-language sentences, and, where the page already prints a formula, an
 * optional "Show the maths" sub-toggle. Dismissing hides it for the session.
 *
 * Models the open-state idiom of StickyGlossary / KeyboardShortcuts. No motion
 * dependency: the reveal uses the existing CSS fadeSlideIn keyframe, which the
 * global prefers-reduced-motion guard neutralises.
 *
 * Imported only by lazy route pages, so it never reaches the eager bundle.
 */
export default function HowToRead({
  id,
  title = 'How to read this',
  points,
  maths,
}: HowToReadProps) {
  const [dismissed, setDismissed] = useState(() => isDismissed(id));
  const [open, setOpen] = useState(false);
  const [showMaths, setShowMaths] = useState(false);

  if (dismissed) return null;

  const panelId = `how-to-read-${id}`;

  return (
    <div style={{ marginTop: SPACE[3] }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: SPACE[2],
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: 13.5,
          fontWeight: 500,
          color: 'var(--ink-soft)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '1em',
            fontWeight: 600,
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 180ms cubic-bezier(0.2, 0, 0, 1)',
          }}
        >
          &rsaquo;
        </span>
        {title}
      </button>

      {open && (
        <div
          id={panelId}
          className="how-to-read-panel"
          style={{
            marginTop: SPACE[2],
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: RADIUS.sm,
            padding: `${SPACE[4]}px ${SPACE[5]}px`,
          }}
        >
          <ul
            style={{
              listStyle: 'disc',
              paddingLeft: SPACE[5],
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE[2],
            }}
          >
            {points.map((point, i) => (
              <li
                key={i}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: TYPE.body.size,
                  lineHeight: TYPE.body.lineHeight,
                  color: 'var(--ink)',
                }}
              >
                {point}
              </li>
            ))}
          </ul>

          {maths != null && (
            <div style={{ marginTop: SPACE[3] }}>
              <button
                type="button"
                onClick={() => setShowMaths((v) => !v)}
                aria-expanded={showMaths}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: SPACE[2],
                  padding: 0,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--ink-soft)',
                }}
              >
                <span aria-hidden="true" style={{ fontWeight: 600 }}>
                  {showMaths ? '−' : '+'}
                </span>
                Show the maths
              </button>
              {showMaths && <div style={{ marginTop: SPACE[2] }}>{maths}</div>}
            </div>
          )}

          <div style={{ marginTop: SPACE[3] }}>
            <button
              type="button"
              onClick={() => {
                persistDismiss(id);
                setDismissed(true);
              }}
              style={{
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: 12.5,
                color: 'var(--ink-faint)',
                textDecoration: 'underline',
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
