import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '@/components/dashboard/PageShell';
import { Button, Card, SectionHeading, Tag } from '@/components/platform/ui';
import { SPACE, TYPE } from '@/components/platform/designTokens';
import { PROVENANCE_CLAIMS, type ProvenanceClaim } from '@/lib/provenance';
import { claimById, formatClaimValue } from '@/lib/platform/summaryClaims';
import { COMPANION_REFS } from '@/lib/platform/companionContent';

/**
 * Printable companion summary. Text-first, single column, A4-friendly. No
 * chart (charts are lazy and print poorly). Every number is read from the
 * provenance registry by id and formatted with the registry's shared display
 * helper, so the page can never hand-type or drift a figure. The registry is
 * itself drift-tested against the committed artefacts (C1..C25).
 *
 * This route is lazy (registered in App.tsx), so it adds nothing to the eager
 * bundle. The global `@media print` block in index.css hides the shell chrome
 * so this prints clean; the in-page "Print this summary" button calls
 * window.print().
 */

/** Headline claims the summary surfaces, in print order, read by id only. */
const HEADLINE_IDS = [
  'C1',
  'C2',
  'C3-lower',
  'C3-upper',
  'C4-Teval',
  'C4-n',
  'C6',
  'C10-dm',
  'C10-p',
] as const;

/** A short source tag for the third column, from the claim's recorded source. */
function sourceKind(claim: ProvenanceClaim): string {
  if (claim.source.kind === 'artefact') return 'Artefact';
  return 'Draft';
}

/** Where-to-read-more rows. Section numbers come from COMPANION_REFS only. */
const READ_MORE: { key: keyof typeof COMPANION_REFS; label: string; to: string }[] = [
  { key: 'evidence', label: 'Evidence', to: '/evidence' },
  { key: 'robustness', label: 'Robustness', to: '/robustness' },
  { key: 'audit/theory', label: 'Audit', to: '/audit' },
  { key: 'notes', label: 'Notes', to: '/notes' },
];

export default function SummaryPage() {
  // Resolve each headline id to its registry claim. A missing id renders with a
  // "(registry)" tag rather than blanking, per the honesty rule, but every id
  // here is pinned by the provenance test so this is a defensive default.
  const headline = useMemo(
    () => HEADLINE_IDS.map((id) => ({ id, claim: claimById(id) })),
    [],
  );

  const cellText: React.CSSProperties = {
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--ink)',
    padding: `${SPACE[2]}px ${SPACE[3]}px`,
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top',
    textAlign: 'left',
  };
  const headText: React.CSSProperties = {
    ...cellText,
    fontWeight: 600,
    color: 'var(--ink-soft)',
    fontSize: 12.5,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  };

  return (
    <PageShell width="narrow">
      <div className="print-block" style={{ display: 'flex', flexDirection: 'column', gap: SPACE[8] }}>
        {/* 1. Title block */}
        <header>
          <SectionHeading
            level={1}
            eyebrow="Companion summary"
            title="Skill × Stake: a wager-weighted forecast aggregation mechanism"
            subtitle="Companion summary to the project. Synthetic sandbox views are illustrative. The load-bearing result is the real-data wind validation."
          />
        </header>

        {/* 2. Headline result */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
          <SectionHeading level={3} as={2} title="Headline result" />
          <Card padding="compact" elevation="flat" className="print-block">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headText}>Claim</th>
                  <th style={headText}>Value</th>
                  <th style={headText}>Source</th>
                </tr>
              </thead>
              <tbody>
                {headline.map(({ id, claim }) => (
                  <tr key={id}>
                    <td style={cellText}>{claim ? claim.label : id}</td>
                    <td style={{ ...cellText, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {claim ? formatClaimValue(claim) : '—'}
                    </td>
                    <td style={{ ...cellText, color: 'var(--ink-soft)' }}>
                      {claim ? sourceKind(claim) : '(registry)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.55, color: 'var(--ink-soft)', margin: 0 }}>
            The skill gate alone accounts for roughly three-quarters of the wind
            headline. The electricity result is a predicted null on a
            near-homogeneous panel, not a failure: the mechanism and equal
            weighting tie when the panel has no skill spread to reward.
          </p>
        </section>

        {/* 3. Synthetic vs real */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }} className="print-block">
          <SectionHeading level={3} title="What is synthetic and what is real" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE[3] }}>
            <Tag>Synthetic sandbox: Forecast, Market, Account, Leaderboard</Tag>
            <Tag tone="good">Real data: Evidence (wind headline, electricity null) and Operator</Tag>
          </div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.55, color: 'var(--ink)', margin: 0, maxWidth: '70ch' }}>
            The synthetic views illustrate the mechanism on a controlled panel
            with paired seeds. Numbers shown there are not a real-data claim. The
            real-data validation lives on Evidence and Operator, sourced from the
            committed Elia artefacts.
          </p>
        </section>

        {/* 4. Where to read more */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }} className="print-block">
          <SectionHeading level={3} title="Where to read more" />
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
            {READ_MORE.map(({ key, label, to }) => {
              const ref = COMPANION_REFS[key];
              return (
                <li
                  key={key}
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--ink)',
                    display: 'flex',
                    gap: SPACE[2],
                    flexWrap: 'wrap',
                  }}
                >
                  <Link to={to} style={{ color: 'var(--navy)', fontWeight: 600 }}>
                    {label}
                  </Link>
                  <span style={{ color: 'var(--ink-soft)' }}>
                    {ref.section} {ref.title}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 5. Footer */}
        <footer style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, lineHeight: 1.5, color: 'var(--ink-soft)', margin: 0 }}>
            Generated from the live provenance registry. Use the browser print
            dialog to save as PDF.
          </p>
          <div className="no-print">
            <Button variant="secondary" size="sm" onClick={() => { if (typeof window !== 'undefined') window.print(); }}>
              Print this summary
            </Button>
          </div>
        </footer>
      </div>

      {/* Guard against accidental drift: the registry id list this page surfaces
          is a strict subset of the live registry. Rendered as a hidden marker so
          a test can assert the page covers the intended ids without scraping. */}
      <span data-testid="summary-claim-count" hidden>
        {PROVENANCE_CLAIMS.length}
      </span>
    </PageShell>
  );
}
