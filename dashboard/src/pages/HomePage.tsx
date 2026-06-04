import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import PageShell from '@/components/dashboard/PageShell';
import { PALETTE } from '@/lib/palette';
import { Card } from '@/components/platform/ui';
import ThesisRef from '@/components/dashboard/ThesisRef';
import { SECTION_INDEX } from '@/lib/platform/companionContent';

/* ────────────────────────────────────────────────────────────────
   HomePage — academic redesign.

   Priorities:
   - Serif display headings, generous type
   - Restrained colour (navy, teal, amber), used as accents only
   - No gradient chrome, no "ping" dots
   - Content flows as a single readable column
   ──────────────────────────────────────────────────────────────── */

const FINDINGS = [
  {
    kicker: 'Real data',
    title: 'Modest improvement on Elia wind, no improvement on electricity',
    evidence: { to: '/evidence', label: 'See the evidence' },
    body:
      'On Elia offshore wind (17,344 evaluation rounds, seven forecasting models) the skill-weighted aggregate lowers mean CRPS by 7.1% versus equal weighting (Diebold\u2013Mariano t = 22.35 with the Andrews 1991 auto bandwidth, p < 0.001). On electricity imbalance prices the mechanism ties equal weighting (t = 0.01) because panel members are too similar to separate, and the per-round oracle still beats the mechanism by 17.0% on wind. The claim is conditional, not dominance.',
    accent: PALETTE.teal,
  },
  {
    kicker: 'Key lever',
    title: 'Deposit policy controls how much the mechanism adds',
    evidence: { to: '/evidence', label: 'See the ablation' },
    body:
      'When deposits correlate with skill, the blended rule approaches the oracle benchmark. When deposits are random or noisy, equal weighting is hard to beat. The deposit regime, not the aggregator alone, drives the result.',
    accent: PALETTE.navy,
  },
  {
    kicker: 'Theoretical',
    title: 'Budget-balanced and narrowly sybil-invariant (Lambert et al. 2008)',
    evidence: { to: '/robustness', label: 'See robustness' },
    body:
      'Total payouts equal total effective wagers to machine precision (residual < 10\u207B\u00B9\u2074). Against identical clones with conserved total wager (Lambert et al. 2008), splitting identity is worth zero, though diversified clone reports break that precondition and leak a small advantage. Consistent with the Chen\u2013Devanur\u2013Pennock\u2013Vaughan (2014) arbitrage interval, a theory-grounded arbitrage seeker earns a positive expected profit.',
    accent: PALETTE.coral,
  },
  {
    kicker: 'Caveat',
    title: 'Equal weighting remains a strong baseline',
    evidence: { to: '/audit', label: 'See the audit' },
    body:
      'Uniform weights are hard to beat under non-stationarity or on small panels. The skill layer helps most when forecasters differ in quality and the panel runs long enough for the online estimator to converge (roughly 50 rounds with N \u2265 6).',
    accent: PALETTE.slate,
  },
] as const;

const NAV_CARDS = [
  { to: '/evidence',   label: 'Evidence',   desc: 'Real data, accuracy & concentration' },
  { to: '/robustness', label: 'Robustness', desc: 'Behaviour taxonomy, attacks & sensitivity' },
  { to: '/explainer',  label: 'Explainer',  desc: 'The mechanism, step by step' },
  { to: '/notes',      label: 'Notes',      desc: 'Experiments & methodology' },
] as const;

function ArrowRightIcon({ className = '', color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className}>
      <path d="M3 7h8M8 3.5L11.5 7 8 10.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <PageShell width="narrow">
        {/* ─── Masthead ───────────────────────────────────────── */}
        <header>
          <p
            className="eyebrow mb-5"
            style={{ color: 'var(--navy)', fontSize: 13 }}
          >
            Master&rsquo;s project &middot; Imperial College London &middot; 2026
          </p>
          <h1
            className="font-serif tracking-tight"
            style={{
              fontSize: 'clamp(36px, 5vw, 48px)',
              lineHeight: 1.1,
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            Self-Financed Prediction Markets with Skill-Weighted Stakes
          </h1>
          <p
            className="font-serif mt-3"
            style={{
              fontSize: 'clamp(20px, 2.5vw, 24px)',
              lineHeight: 1.3,
              color: 'var(--ink-muted)',
              fontWeight: 400,
              fontStyle: 'italic',
            }}
          >
            A weighted-score wagering mechanism with an online skill-estimation layer
          </p>

          <div
            className="mt-8"
            style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--ink-muted)' }}
          >
            <div style={{ fontWeight: 600, color: 'var(--ink)' }}>Anastasia Cattaneo</div>
            <div style={{ marginTop: 4, color: 'var(--ink-soft)' }}>
              Supervisors: Pierre Pinson &middot; Michael Vitali
            </div>
          </div>
          <ThesisRef viewKey="research" style={{ marginTop: 16 }} />
        </header>

        {/* ─── Research question ───────────────────────────────── */}
        <section aria-labelledby="research-question">
          <h2 id="research-question" className="sr-only">Research question</h2>
          <Card
            padding="roomy"
            elevation="raised"
            style={{ borderLeft: '3px solid var(--navy)' }}
          >
            <p className="eyebrow mb-3" style={{ color: 'var(--navy)', fontSize: 13 }}>
              Research question
            </p>
            <p
              className="font-serif"
              style={{
                fontSize: 20,
                lineHeight: 1.6,
                color: 'var(--ink-muted)',
              }}
            >
              Can an online skill-estimation layer, combined with stake-based deposits,
              produce better probabilistic forecast aggregates than equal weighting when
              forecasters are heterogeneous, the data are non-stationary, and some agents
              behave strategically?
            </p>
          </Card>
        </section>

        {/* ─── Contribution ──────────────────────────────────── */}
        <section aria-labelledby="contribution">
          <h2 id="contribution" className="eyebrow mb-4" style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
            Contribution
          </h2>
          <p
            className="font-serif"
            style={{ fontSize: 19, lineHeight: 1.65, color: 'var(--ink-muted)' }}
          >
            This project extends the Lambert et al. (2008) self-financed wagering mechanism with an{' '}
            <span style={{ color: 'var(--ink)', fontWeight: 600 }}>online skill layer</span> that gates each
            effective wager.{' '}
            <Link to="/explainer" style={{ color: 'var(--navy)', fontWeight: 600 }}>
              See the explainer for the full mechanism.
            </Link>
          </p>
        </section>

        {/* ─── Key findings ──────────────────────────────────── */}
        <section aria-labelledby="findings">
          <h2 id="findings" className="eyebrow mb-2" style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
            Principal findings
          </h2>
          <ThesisRef section="§5.1" title="Findings" style={{ marginBottom: 20 }} />
          <div className="space-y-5">
            {FINDINGS.map((f) => (
              <Card
                as="article"
                key={f.title}
                padding="default"
                elevation="raised"
                style={{ borderLeft: `3px solid ${f.accent}` }}
              >
                <p
                  className="eyebrow mb-2"
                  style={{ color: f.accent, fontSize: 13 }}
                >
                  {f.kicker}
                </p>
                <h3
                  className="font-serif"
                  style={{
                    fontSize: 22, lineHeight: 1.3,
                    fontWeight: 600, color: 'var(--ink)',
                  }}
                >
                  {f.title}
                </h3>
                <p
                  style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--ink-soft)', marginTop: 10 }}
                >
                  {f.body}
                </p>
                {f.evidence && (
                  <Link
                    to={f.evidence.to}
                    className="group inline-flex items-center gap-1.5 mt-3 transition-colors"
                    style={{ fontSize: 14, fontWeight: 600, color: f.accent }}
                  >
                    {f.evidence.label}
                    <ArrowRightIcon
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                      color={f.accent}
                    />
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </section>

        {/* ─── Section index (draft chapter → dashboard view) ───── */}
        <section aria-labelledby="section-index">
          <h2 id="section-index" className="eyebrow mb-2" style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
            Where each chapter lives
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-soft)', marginBottom: 16, maxWidth: '70ch' }}>
            Each draft chapter maps to the view that holds its evidence.
          </p>
          <Card padding="default" elevation="raised">
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {SECTION_INDEX.map((row, i) => (
                <li
                  key={row.chapter}
                  className="section-index-row"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 500, flex: '1 1 16rem', minWidth: 0 }}>
                    {row.chapter}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ flex: '0 1 auto' }}>
                    {row.views.map((v, j) => (
                      <Fragment key={v.to + j}>
                        {j > 0 && <span style={{ color: 'var(--ink-faint)', fontSize: 13 }}>·</span>}
                        <Link
                          to={v.to}
                          className="group inline-flex items-center gap-1 transition-colors"
                          style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}
                        >
                          {v.label}
                          <ArrowRightIcon
                            className="transition-transform duration-200 group-hover:translate-x-0.5"
                            color="var(--navy)"
                          />
                        </Link>
                      </Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        {/* ─── Navigation ────────────────────────────────────── */}
        <nav aria-labelledby="nav-cards">
          <h2 id="nav-cards" className="eyebrow mb-5" style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
            Explore the project
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {NAV_CARDS.map((l) => (
              <Card
                key={l.to}
                interactive
                padding="compact"
                elevation="raised"
                className="group block transition-colors"
                {...({ as: Link, to: l.to } as { as: typeof Link; to: string })}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="font-serif"
                    style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)' }}
                  >
                    {l.label}
                  </span>
                  <ArrowRightIcon
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                    color="var(--navy)"
                  />
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-soft)', marginTop: 8 }}>
                  {l.desc}
                </p>
              </Card>
            ))}
          </div>
        </nav>

        {/* ─── Colophon ───────────────────────────────────────── */}
        <footer
          className="pt-10"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p style={{ fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center' }}>
            <Link to="/summary" style={{ color: 'var(--navy)', fontWeight: 600 }}>
              Printable summary
            </Link>
          </p>
          <p style={{ fontSize: 13, color: 'var(--ink-faint)', textAlign: 'center', marginTop: 8 }}>
            Anastasia Cattaneo &middot; Imperial College London &middot; &copy; 2026
          </p>
        </footer>
    </PageShell>
  );
}
