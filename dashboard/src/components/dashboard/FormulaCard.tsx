import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface FormulaCardProps {
  title: string;
  /** LaTeX string for the formula (preferred — always use for math). */
  latex?: string;
  /** Plain-text fallback when latex is not provided. */
  formula?: string;
  caption: string;
}

/**
 * Academic formula card — warm paper surface, serif title with navy
 * accent rule, cream-tinted formula panel.
 */
export default function FormulaCard({ title, latex, formula, caption }: FormulaCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (latex != null && latex !== '' && containerRef.current) {
      try {
        katex.render(latex, containerRef.current, { displayMode: true, throwOnError: false });
      } catch {
        containerRef.current.textContent = latex;
      }
    }
  }, [latex]);

  const hasLatex = latex != null && latex !== '';

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 18,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span
          aria-hidden="true"
          className="inline-block"
          style={{ width: 3, height: 16, background: 'var(--navy)', borderRadius: 2 }}
        />
        <h3
          className="font-serif tracking-tight"
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}
        >
          {title}
        </h3>
      </div>
      {hasLatex ? (
        <div
          className="overflow-x-auto text-center flex items-center justify-center"
          style={{
            background: 'var(--cream)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '16px 18px',
            minHeight: '2.75rem',
          }}
        >
          <div ref={containerRef} className="katex-block" style={{ fontSize: 15 }} />
        </div>
      ) : (
        <code
          className="block overflow-x-auto font-mono"
          style={{
            background: 'var(--cream)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '12px 16px',
            fontSize: 13.5,
            color: 'var(--ink-muted)',
          }}
        >
          {formula ?? ''}
        </code>
      )}
      <p
        className="leading-relaxed"
        style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 10, lineHeight: 1.55 }}
      >
        {caption}
      </p>
    </div>
  );
}
