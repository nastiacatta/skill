import { useEffect, useRef } from 'react';
import clsx from 'clsx';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useEquationNumber } from '@/hooks/useSequentialNumber';

interface VariableLegendEntry {
  symbol: string;
  meaning: string;
}

interface MathBlockProps {
  /** LaTeX equation to render. Use this for proper math typesetting. */
  latex?: string;
  /** Inline math (span) instead of display block; use inside paragraphs */
  inline?: boolean;
  /** Fallback: plain text / Unicode when latex is not provided */
  children?: React.ReactNode;
  /** Optional label above (e.g. "Effective wager") */
  label?: string;
  /** Optional small caption below */
  caption?: string;
  className?: string;
  /** Highlight as key design choice */
  accent?: boolean;
  /** Plain-English explanation of the formula */
  explanation?: string;
  /** Variable legend entries */
  variables?: VariableLegendEntry[];
  /** Auto-applies accent + triggers explanation/legend rendering */
  isCritical?: boolean;
}

export default function MathBlock({
  latex,
  inline,
  children,
  label,
  caption,
  className,
  accent,
  explanation,
  variables,
  isCritical,
}: MathBlockProps) {
  const containerRef = useRef<HTMLDivElement | HTMLSpanElement>(null);
  const eqNum = useEquationNumber();

  // isCritical auto-applies accent styling
  const showAccent = accent || isCritical;

  useEffect(() => {
    if (latex != null && latex !== '' && containerRef.current) {
      try {
        katex.render(latex, containerRef.current, { displayMode: !inline, throwOnError: false });
      } catch {
        containerRef.current.textContent = latex;
      }
    }
  }, [latex, inline]);

  // Inline formulas: no equation number, no explanation/legend
  if (inline && latex != null && latex !== '') {
    return <span ref={containerRef as React.RefObject<HTMLSpanElement>} className={clsx('katex-inline', className)} />;
  }

  // Whether to show explanation and variable legend (only when isCritical)
  const showDetails = isCritical && (explanation || (variables && variables.length > 0));

  return (
    <div
      className={clsx('text-center', className)}
      style={showAccent ? {
        border: '1px solid rgba(29, 52, 97, 0.25)',
        background: 'var(--navy-tint)',
        color: 'var(--ink)',
        padding: '12px 16px',
        borderRadius: 4,
      } : undefined}
    >
      {label && (
        <p
          className="font-sans uppercase"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--ink-soft)',
            marginBottom: 6,
          }}
        >
          {label}
        </p>
      )}

      {/* Formula row with equation number */}
      <div className="flex items-center">
        <div className="flex-1 min-w-0">
          {latex != null && latex !== '' ? (
            <div ref={containerRef as React.RefObject<HTMLDivElement>} className="katex-block text-sm min-h-[1.5em]" />
          ) : (
            <div className="font-mono text-sm break-all">{children}</div>
          )}
        </div>
        <span
          className="ml-2 shrink-0 font-sans"
          style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)' }}
        >
          Eq.&nbsp;{eqNum}
        </span>
      </div>

      {caption && (
        <p
          className="font-sans"
          style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}
        >
          {caption}
        </p>
      )}

      {/* Explanation and variable legend for critical formulas */}
      {showDetails && (
        <div className="mt-3 text-left">
          {explanation && (
            <p style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.55 }}>
              {explanation}
            </p>
          )}
          {variables && variables.length > 0 && (
            <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {variables.map((v) => (
                <div key={v.symbol} className="contents">
                  <span
                    className="font-mono text-left"
                    style={{ fontSize: 12, color: 'var(--ink)' }}
                  >
                    {v.symbol}
                  </span>
                  <span
                    className="font-sans text-right"
                    style={{ fontSize: 12, color: 'var(--ink-muted)' }}
                  >
                    {v.meaning}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
