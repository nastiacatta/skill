import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** One-line subtitle (e.g. thesis or page purpose) */
  subtitle?: string;
  description?: string;
  /** One-line research question or framing */
  question?: string;
  /** One-line takeaway or key result */
  takeaway?: string;
  /** Control row (selects, sliders, etc.) */
  controls?: ReactNode;
  /** Breadcrumb trail */
  breadcrumbs?: { label: string; to?: string }[];
  /** When true, title uses larger hero styling */
  hero?: boolean;
  /** Optional eyebrow label (rendered above the title) */
  eyebrow?: string;
  /** Optional companion metadata line (e.g. a ThesisRef) under the title. */
  companion?: ReactNode;
}

/**
 * Academic page header — serif title, understated eyebrow, readable lead.
 */
export default function PageHeader({
  title,
  subtitle,
  description,
  question,
  takeaway,
  controls,
  breadcrumbs,
  hero = false,
  eyebrow,
  companion,
}: PageHeaderProps) {
  return (
    <header className="mb-8">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          className="flex items-center gap-1.5 mb-3"
          style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}
        >
          {breadcrumbs.map((b, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span style={{ color: 'var(--ink-faint)', opacity: 0.5 }}>/</span>}
              {b.to ? (
                <Link
                  to={b.to}
                  className="transition-colors"
                  style={{ color: 'var(--ink-soft)' }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink)'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-soft)'; }}
                >
                  {b.label}
                </Link>
              ) : (
                <span style={{ color: 'var(--ink-soft)' }}>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {eyebrow && (
        <p className="eyebrow mb-3" style={{ color: 'var(--navy)' }}>
          {eyebrow}
        </p>
      )}

      <h1
        className="font-serif tracking-tight"
        style={{
          fontSize: hero ? 'clamp(32px, 4vw, 42px)' : 28,
          lineHeight: 1.15,
          fontWeight: 600,
          color: 'var(--ink)',
        }}
      >
        {title}
      </h1>

      {companion && <div style={{ marginTop: 10 }}>{companion}</div>}

      {subtitle && (
        <p
          className="font-serif"
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: 'var(--ink-muted)',
            marginTop: 14,
            // Measure-based cap: ~75ch keeps line length readable without
            // forcing awkward early wraps on wide viewports.
            maxWidth: '75ch',
          }}
        >
          {subtitle}
        </p>
      )}

      {description && (
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--ink-soft)',
            marginTop: 10,
            maxWidth: '78ch',
          }}
        >
          {description}
        </p>
      )}

      {question && (
        <p
          className="font-serif"
          style={{
            fontSize: 16.5,
            lineHeight: 1.55,
            color: 'var(--ink)',
            marginTop: 14,
            fontWeight: 500,
          }}
        >
          {question}
        </p>
      )}

      {takeaway && (
        <p
          className="font-serif italic"
          style={{
            fontSize: 15.5,
            lineHeight: 1.55,
            color: 'var(--ink-soft)',
            marginTop: 8,
          }}
        >
          {takeaway}
        </p>
      )}

      {controls && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {controls}
        </div>
      )}
    </header>
  );
}
