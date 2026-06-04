import type { ReactNode } from 'react';
import { TYPE, SPACE } from '@/components/platform/designTokens';

type Level = 1 | 2 | 3;
type Align = 'start' | 'center';

const LEVEL_TYPE = {
  1: TYPE.h1,
  2: TYPE.h2,
  3: TYPE.h3,
} as const;

export interface SectionHeadingProps {
  /** Small uppercase eyebrow above the title. */
  eyebrow?: string;
  title: ReactNode;
  /** One-line takeaway / insight under the title (research §3). */
  subtitle?: ReactNode;
  /** Optional companion metadata line (e.g. a ThesisRef) under the subtitle. */
  companion?: ReactNode;
  /** Heading level (visual + semantic). */
  level?: Level;
  /**
   * Semantic heading tag, decoupled from the visual `level`. Use to give a
   * page a single h1 or keep the document outline ordered (no skipped levels)
   * without changing the type scale. Defaults to `level`.
   */
  as?: Level;
  align?: Align;
  /** Right-aligned actions (controls, links). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Eyebrow + serif title + optional subtitle/insight line, with an
 * optional actions slot. The platform's lighter showcase heading
 * (the lettered A/B/C variant lives in `dashboard/SectionHeader`).
 *
 * Spec: design_system.md §1 (type ladder); states the one insight per
 * view in text (ui_research §3).
 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  companion,
  level = 2,
  as,
  align = 'start',
  actions,
  className = '',
}: SectionHeadingProps) {
  const t = LEVEL_TYPE[level];
  // Visual size follows `level`; the semantic tag follows `as` when given so
  // the document outline can be corrected without restyling.
  const Tag = (`h${as ?? level}` as 'h1' | 'h2' | 'h3');
  return (
    <div
      className={`platform-section-heading ${className}`.trim()}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: actions ? 'space-between' : undefined,
        gap: SPACE[4],
        textAlign: align === 'center' ? 'center' : 'start',
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <p
            className="eyebrow"
            style={{
              fontSize: TYPE.label.size,
              fontWeight: TYPE.label.weight,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink-soft)',
              margin: 0,
              marginBottom: SPACE[2],
            }}
          >
            {eyebrow}
          </p>
        )}
        <Tag
          style={{
            fontFamily: t.family,
            fontSize: t.size,
            lineHeight: t.lineHeight,
            fontWeight: t.weight,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
            margin: 0,
          }}
        >
          {title}
        </Tag>
        {subtitle && (
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: TYPE.lead.size,
              lineHeight: TYPE.lead.lineHeight,
              color: 'var(--ink-soft)',
              margin: 0,
              marginTop: SPACE[2],
              maxWidth: '64ch',
            }}
          >
            {subtitle}
          </p>
        )}
        {companion && <div style={{ marginTop: SPACE[2] }}>{companion}</div>}
      </div>
      {actions && <div style={{ flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
