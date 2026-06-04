import type { ReactNode } from 'react';

export interface SectionHeaderProps {
  /** Section label, e.g. "A", "B", "C". */
  label: string;
  /** Section title rendered after the label. */
  title: string;
  /** Optional description rendered below the title. */
  description?: string;
  /** Content rendered below the header. */
  children: ReactNode;
}

/**
 * Academic section header — small navy lettered label paired with a serif title.
 */
export default function SectionHeader({
  label,
  title,
  description,
  children,
}: SectionHeaderProps) {
  return (
    <section>
      <h3
        className="flex items-baseline gap-2.5"
        style={{ margin: 0 }}
      >
        {label && (
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center font-mono"
            style={{
              minWidth: 22, height: 22, padding: '0 6px',
              borderRadius: 3,
              background: 'var(--navy-tint)',
              color: 'var(--navy)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {label}
          </span>
        )}
        <span
          className="font-serif tracking-tight"
          style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}
        >
          {title}
        </span>
      </h3>

      {description && (
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: 'var(--ink-soft)',
            marginTop: 6,
          }}
        >
          {description}
        </p>
      )}

      <div className="mt-4">
        {children}
      </div>
    </section>
  );
}
