import { Link } from 'react-router-dom';
import type { CompanionKey, CompanionRef } from '@/lib/platform/companionContent';
import { COMPANION_REFS } from '@/lib/platform/companionContent';

/**
 * Thesis-companion line. A small muted metadata line that names the draft
 * section a view supports, in the draft's own terms, so a reader with the draft
 * open can turn straight to the matching section. Text only: it names the
 * section, it does not deep-link into the read-only PDF.
 *
 * Styled like the existing eyebrow / provenance pill so it reads as metadata,
 * not content. It sits directly under the H1 or beside the provenance badge.
 *
 * Pass either an explicit `section`/`title` pair or a `viewKey` that resolves
 * the canonical companion content from `companionContent.ts` (the single source
 * shared with the section index and the guided tour). Every claim chip resolves
 * to a C-id in the provenance registry; chips link to the dev-only provenance
 * panel and never render as a visitor link.
 */
export interface ThesisRefProps {
  /** Resolve all fields from the canonical companion map. */
  viewKey?: CompanionKey;
  /** Section / chapter label, e.g. "§4.2". Overrides the viewKey value. */
  section?: string;
  /** Verbatim draft heading text. Overrides the viewKey value. */
  title?: string;
  /** Optional figure / table reference, e.g. "Fig. F28". */
  fig?: string;
  /** Optional claim ids (C-ids) shown as muted chips. */
  claims?: string[];
  /** Optional scope / cross-reference note. */
  note?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Dev / preview builds expose the provenance panel; visitor builds do not. */
const DIAGNOSTICS_ENABLED = import.meta.env.DEV || import.meta.env.MODE === 'preview';

export default function ThesisRef({
  viewKey,
  section,
  title,
  fig,
  claims,
  note,
  className = '',
  style,
}: ThesisRefProps) {
  const base: CompanionRef | undefined = viewKey ? COMPANION_REFS[viewKey] : undefined;
  const sec = section ?? base?.section;
  const ttl = title ?? base?.title;
  const figRef = fig ?? base?.fig;
  const claimIds = claims ?? base?.claims;
  const scopeNote = note ?? base?.note;

  if (!sec || !ttl) return null;

  return (
    <p
      className={`thesis-ref ${className}`.trim()}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        lineHeight: 1.5,
        color: 'var(--ink-faint)',
        margin: 0,
        ...style,
      }}
    >
      <span
        className="inline-flex items-center gap-1.5"
        style={{ fontWeight: 500 }}
      >
        <BookIcon />
        <span>
          Companion to thesis{' '}
          <span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>{sec}</span>{' '}
          {ttl}
          {figRef ? ` (${figRef})` : ''}
        </span>
      </span>

      {claimIds && claimIds.length > 0 && (
        <span className="inline-flex items-center gap-1" aria-label="Supporting claims">
          {claimIds.map((id: string) =>
            DIAGNOSTICS_ENABLED ? (
              <Link
                key={id}
                to={`/dev/provenance?claim=${encodeURIComponent(id)}`}
                className="thesis-ref-chip"
                style={chipStyle}
              >
                {id}
              </Link>
            ) : (
              <span key={id} className="thesis-ref-chip" style={chipStyle}>
                {id}
              </span>
            ),
          )}
        </span>
      )}

      {scopeNote && (
        <span style={{ fontStyle: 'italic', color: 'var(--ink-faint)' }}>{scopeNote}</span>
      )}
    </p>
  );
}

const chipStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: '18px',
  padding: '0 7px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  color: 'var(--ink-soft)',
  background: 'var(--card)',
  fontVariantNumeric: 'tabular-nums',
  textDecoration: 'none',
};

function BookIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M2 2.5h3.2c.7 0 1.3.3 1.8.8.5-.5 1.1-.8 1.8-.8H12v8.2H8.8c-.7 0-1.3.3-1.8.8-.5-.5-1.1-.8-1.8-.8H2V2.5Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M7 3.3v7.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
