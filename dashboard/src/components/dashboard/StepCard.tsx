import { useState, type ReactNode } from 'react';
import clsx from 'clsx';

interface StepCardProps {
  stepNumber: number;
  title: string;
  description?: string;
  children: ReactNode;
  /** Optional expandable content (e.g. Core sub-components) */
  expandable?: ReactNode;
  /** Whether this step is complete/selected */
  isActive?: boolean;
}

/**
 * Academic step card — navy filled step badge with a serif numeral,
 * warm paper surface, and a subtle expand-details affordance.
 */
export default function StepCard({
  stepNumber,
  title,
  description,
  children,
  expandable,
  isActive = true,
}: StepCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      className="transition-all duration-150"
      style={{
        background: isActive ? 'var(--card)' : 'var(--cream)',
        border: `1px solid ${isActive ? 'var(--border)' : 'var(--border)'}`,
        borderRadius: 6,
        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
      }}
      aria-labelledby={`step-${stepNumber}-title`}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 34,
              height: 34,
              fontSize: 15,
              fontWeight: 600,
              background: isActive ? 'var(--navy)' : 'var(--cream)',
              color: isActive ? '#fbf9f4' : 'var(--ink-soft)',
              fontFamily: 'var(--font-serif)',
              border: isActive ? 'none' : '1px solid var(--border-strong)',
              boxShadow: isActive ? '0 1px 2px rgba(29, 52, 97, 0.2)' : 'none',
            }}
          >
            {stepNumber}
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id={`step-${stepNumber}-title`}
              className="font-serif tracking-tight"
              style={{ fontSize: 17, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3 }}
            >
              {title}
            </h2>
            {description && (
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--ink-soft)',
                  lineHeight: 1.55,
                  marginTop: 4,
                }}
              >
                {description}
              </p>
            )}
            <div className="mt-4">{children}</div>
            {expandable && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => !e)}
                  className="inline-flex items-center gap-1 transition-colors"
                  aria-expanded={expanded}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: 'var(--navy)',
                  }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--navy-ink)'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--navy)'; }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className={clsx('transition-transform duration-150', expanded && 'rotate-90')}
                  >
                    <path
                      d="M6 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {expanded ? 'Hide details' : 'Show sub-components'}
                </button>
                {expanded && (
                  <div
                    className="mt-3 animate-in fade-in slide-in-from-top-1 duration-150"
                    style={{
                      background: 'var(--cream)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      padding: 12,
                      fontSize: 13,
                      color: 'var(--ink-soft)',
                      lineHeight: 1.55,
                    }}
                  >
                    {expandable}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
