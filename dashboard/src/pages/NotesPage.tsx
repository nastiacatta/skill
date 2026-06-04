import { Link } from 'react-router-dom';
import PageShell from '@/components/dashboard/PageShell';
import { Card, SectionHeading } from '@/components/platform/ui';
import Breadcrumb from '@/components/dashboard/Breadcrumb';
import ThesisRef from '@/components/dashboard/ThesisRef';

const EXPERIMENTS = [
  {
    id: 'real-data-wind',
    title: 'Real data: Elia offshore wind, mechanism −7.1% CRPS (full 17,344-round window)',
    status: 'confirmed' as const,
    finding: 'On the wind panel the wagering mechanism reduces mean CRPS by 7.1% versus uniform weighting (DM t = 22.35, p ≈ 0), with the skill gate alone delivering about three-quarters of that.',
    data: [
      { label: 'Mechanism (skill × stake)', delta: '0.037881', pct: '+7.1%', sig: true },
      { label: 'Skill-only', delta: '0.038685', pct: '+5.15%', sig: true },
      { label: 'Equal (uniform)', delta: '0.040786', pct: '0.0%', sig: false },
    ],
  },
  {
    id: 'electricity-null',
    title: 'Real data: Elia electricity imbalance, mechanism ties uniform (null by design)',
    status: 'confirmed' as const,
    finding: 'On the near-homogeneous electricity panel there is no skill spread to exploit, so over 9,800 rounds the mechanism and uniform both reach CRPS 0.0905 (DM t = 0.01, p = 0.994), the predicted null.',
    data: [
      { label: 'Mechanism (skill × stake)', delta: '0.090520', pct: '0.0%', sig: false },
      { label: 'Equal (uniform)', delta: '0.090520', pct: '0.0%', sig: false },
    ],
  },
  {
    id: 'deposit-sensitivity',
    title: 'Deposit policy shapes whether the skill signal survives (synthetic panel)',
    status: 'confirmed' as const,
    finding: 'On the synthetic panel fixed unit deposits give a 5.2% CRPS gain whereas exponential deposits drown the skill signal and the gain falls to zero, so the real-data runs above fix unit deposits to isolate the skill gate.',
    data: [
      { label: 'Synthetic: Fixed deposits', delta: '-0.002862', pct: '+5.2%', sig: true },
      { label: 'Synthetic: Exponential deposits', delta: '-0.000006', pct: '+0.0%', sig: false },
    ],
  },
] as const;

const STATUS_META = {
  confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Confirmed' },
  partial:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500',   label: 'Partial' },
  rejected:  { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',     label: 'Rejected' },
} as const;

function StatusPill({ status }: { status: keyof typeof STATUS_META }) {
  const m = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[13px] font-semibold border ${m.bg} ${m.text} ${m.border}`}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export default function NotesPage() {
  const statuses = EXPERIMENTS.map((e) => e.status as string);
  const confirmedCount = statuses.filter((s) => s === 'confirmed').length;
  const partialCount = statuses.filter((s) => s === 'partial').length;

  return (
    <PageShell width="narrow">

        <Breadcrumb />
        <header>
          <SectionHeading
            level={1}
            eyebrow="Research Notes"
            title="Mechanism results and experiments"
            companion={<ThesisRef viewKey="notes" />}
          />
          <p
            className="font-serif mt-4"
            style={{
              fontSize: 18,
              lineHeight: 1.55,
              color: 'var(--ink-muted)',
              maxWidth: '68ch',
            }}
          >
            Companion data tables. All deltas are reported versus equal weighting.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2" style={{ fontSize: 13 }}>
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium"
              style={{
                background: 'var(--teal-tint)',
                color: 'var(--teal-deep)',
                border: '1px solid rgba(15, 118, 110, 0.2)',
              }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--teal)' }} />
              {confirmedCount} confirmed
            </span>
            {partialCount > 0 && (
              <span
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium"
                style={{
                  background: 'var(--amber-tint)',
                  color: 'var(--amber)',
                  border: '1px solid rgba(180, 83, 9, 0.2)',
                }}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--amber)' }} />
                {partialCount} partial
              </span>
            )}
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full font-medium"
              style={{
                background: 'var(--card)',
                color: 'var(--ink-soft)',
                border: '1px solid var(--border)',
              }}
            >
              {EXPERIMENTS.length} total entries
            </span>
          </div>
        </header>

        <div className="space-y-5">
          {EXPERIMENTS.map((exp, i) => (
            <Card
              as="section"
              key={exp.id}
              id={exp.id}
              padding="default"
              elevation="raised"
              className="scroll-mt-24 space-y-4"
            >
              <div className="flex items-start gap-4">
                <span
                  className="mt-0.5 flex items-center justify-center shrink-0 font-mono"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 4,
                    background: 'var(--cream)',
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--ink-soft)',
                  }}
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusPill status={exp.status} />
                  </div>
                  <h2
                    className="font-serif tracking-tight mt-2"
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: 'var(--ink)',
                      lineHeight: 1.3,
                    }}
                  >
                    {exp.title}
                  </h2>
                  <p
                    className="mt-2"
                    style={{ fontSize: 15, color: 'var(--ink-soft)', lineHeight: 1.6 }}
                  >
                    {exp.finding}
                  </p>
                </div>
              </div>

              <div
                className="overflow-x-auto"
                style={{ border: '1px solid var(--border)', borderRadius: 4 }}
              >
                <table className="w-full" style={{ fontSize: 14 }}>
                  <thead>
                    <tr
                      style={{
                        background: 'var(--cream)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <th
                        className="text-left uppercase"
                        style={{
                          padding: '10px 16px',
                          fontSize: 13,
                          fontWeight: 700,
                          letterSpacing: '0.12em',
                          color: 'var(--ink-soft)',
                        }}
                      >
                        Variant
                      </th>
                      <th
                        className="text-right uppercase"
                        style={{
                          padding: '10px 12px',
                          fontSize: 13,
                          fontWeight: 700,
                          letterSpacing: '0.12em',
                          color: 'var(--ink-soft)',
                        }}
                      >
                        Mean CRPS
                      </th>
                      <th
                        className="text-right uppercase"
                        style={{
                          padding: '10px 12px',
                          fontSize: 13,
                          fontWeight: 700,
                          letterSpacing: '0.12em',
                          color: 'var(--ink-soft)',
                        }}
                      >
                        % vs equal
                      </th>
                      <th
                        className="text-center uppercase"
                        style={{
                          padding: '10px 16px',
                          fontSize: 13,
                          fontWeight: 700,
                          letterSpacing: '0.12em',
                          color: 'var(--ink-soft)',
                        }}
                      >
                        Sig.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {exp.data.map((row, rowIdx, arr) => {
                      const isLast = rowIdx === arr.length - 1;
                      const deltaNeg = row.delta.startsWith('-');
                      const pctPos = row.pct.startsWith('+') && row.sig;
                      return (
                        <tr
                          key={row.label}
                          style={{
                            borderBottom: isLast ? 'none' : '1px solid var(--border)',
                          }}
                        >
                          <td
                            style={{
                              padding: '8px 16px',
                              color: 'var(--ink)',
                              fontWeight: 500,
                            }}
                          >
                            {row.label}
                          </td>
                          <td
                            className="text-right font-mono tabular-nums"
                            style={{
                              padding: '8px 12px',
                              color: deltaNeg ? 'var(--teal-deep)' : 'var(--ink-soft)',
                              fontWeight: deltaNeg ? 600 : 400,
                            }}
                          >
                            {row.delta}
                          </td>
                          <td
                            className="text-right font-mono tabular-nums"
                            style={{
                              padding: '8px 12px',
                              color: pctPos ? 'var(--teal-deep)' : 'var(--ink-soft)',
                              fontWeight: pctPos ? 600 : 400,
                            }}
                          >
                            {row.pct}
                          </td>
                          <td
                            className="text-center"
                            style={{ padding: '8px 16px' }}
                          >
                            {row.sig ? (
                              <span
                                className="inline-flex items-center justify-center"
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: '50%',
                                  background: 'var(--teal-tint)',
                                  color: 'var(--teal-deep)',
                                }}
                                role="img"
                                aria-label="Significant"
                              >
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                  <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
                            ) : (
                              <span style={{ color: 'var(--ink-faint)' }} title="Not significant">n.s.</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </Card>
          ))}
        </div>

        <Card padding="default" elevation="raised">
          <h3
            className="font-serif mb-3 tracking-tight flex items-center gap-2.5"
            style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}
          >
            <span
              className="inline-block"
              style={{ width: 3, height: 16, background: 'var(--teal)', borderRadius: 2 }}
            />
            Methodology
          </h3>
          <p style={{ fontSize: 14, color: 'var(--ink-muted)', lineHeight: 1.65 }}>
            Synthetic runs use paired seeds and a paired t-test. Real-data runs use the
            Diebold&ndash;Mariano statistic under Andrews-automatic HAC errors. Full methodology lives in the project draft.
          </p>
          <Link
            to="/evidence"
            className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 group"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5">
              <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to main results
          </Link>
        </Card>
    </PageShell>
  );
}
