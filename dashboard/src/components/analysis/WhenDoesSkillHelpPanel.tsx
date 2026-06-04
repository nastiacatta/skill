/**
 * "When Does Skill Help?" conditioning panel.
 *
 * Grid/table of ΔCRPS broken down by conditioning variables
 * (panel size N, horizon T, skill heterogeneity τ spread).
 * "Not significant" label when CI includes zero.
 * Summary statement at bottom.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */

interface ConditionBreakdown {
  condition: string;
  n: number;
  t: number;
  tauSpread: number;
  deltaCrps: number;
  se: number;
  ciLow: number;
  ciHigh: number;
  significant: boolean;
}

interface WhenDoesSkillHelpPanelProps {
  data: ConditionBreakdown[];
}

import PanelShell from './PanelShell';

export default function WhenDoesSkillHelpPanel({ data }: WhenDoesSkillHelpPanelProps) {
  if (data.length === 0) {
    return (
      <PanelShell title="When does skill help?" accent="var(--teal)" emptyState="No conditioning data available." />
    );
  }

  // Derive summary: find minimum conditions where mechanism reliably beats equal
  const significantRows = data.filter((d) => d.significant && d.deltaCrps < 0);
  let summaryStatement = 'The mechanism does not reliably beat equal weighting under any tested condition.';

  if (significantRows.length > 0) {
    const minN = Math.min(...significantRows.map((d) => d.n));
    const minT = Math.min(...significantRows.map((d) => d.t));
    const minTau = Math.min(...significantRows.map((d) => d.tauSpread));
    summaryStatement = `The mechanism reliably beats equal weighting when N ≥ ${minN}, T ≥ ${minT}, and τ spread ≥ ${minTau.toFixed(1)}.`;
  }

  return (
    <PanelShell title="When does skill help?" accent="var(--teal)">
      {/* Table */}
      <div
        className="overflow-x-auto"
        style={{ border: '1px solid var(--border)', borderRadius: 4 }}
      >
        <table className="w-full" style={{ fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)' }}>
              <th className="text-left uppercase" style={{ padding: '10px 12px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>Condition</th>
              <th className="text-right uppercase" style={{ padding: '10px 8px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>N</th>
              <th className="text-right uppercase" style={{ padding: '10px 8px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>T</th>
              <th className="text-right uppercase" style={{ padding: '10px 8px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>τ spread</th>
              <th className="text-right uppercase" style={{ padding: '10px 8px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>ΔCRPS</th>
              <th className="text-right uppercase" style={{ padding: '10px 8px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>95% CI</th>
              <th className="text-center uppercase" style={{ padding: '10px 12px', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>Sig.</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const isLast = i === data.length - 1;
              const sign =
                row.deltaCrps < 0
                  ? 'var(--teal-deep)'
                  : row.deltaCrps > 0
                  ? 'var(--crimson)'
                  : 'var(--ink-muted)';
              return (
                <tr
                  key={i}
                  style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
                >
                  <td style={{ padding: '8px 12px', color: 'var(--ink)', fontWeight: 500 }}>{row.condition}</td>
                  <td className="text-right font-mono tabular-nums" style={{ padding: '8px', color: 'var(--ink-muted)' }}>{row.n}</td>
                  <td className="text-right font-mono tabular-nums" style={{ padding: '8px', color: 'var(--ink-muted)' }}>{row.t}</td>
                  <td className="text-right font-mono tabular-nums" style={{ padding: '8px', color: 'var(--ink-muted)' }}>{row.tauSpread.toFixed(2)}</td>
                  <td className="text-right font-mono tabular-nums" style={{ padding: '8px', color: sign, fontWeight: 600 }}>{row.deltaCrps.toFixed(4)}</td>
                  <td className="text-right font-mono tabular-nums whitespace-nowrap" style={{ padding: '8px', color: 'var(--ink-muted)' }}>
                    [{row.ciLow.toFixed(4)}, {row.ciHigh.toFixed(4)}]
                  </td>
                  <td className="text-center" style={{ padding: '8px 12px' }}>
                    {row.significant ? (
                      <span
                        className="inline-flex items-center justify-center"
                        style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--teal-tint)', color: 'var(--teal-deep)' }}
                        aria-label="Significant"
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    ) : (
                      <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontWeight: 500 }}>
                        n.s.
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <p
        className="mt-4 pt-4"
        style={{
          fontSize: 13,
          color: 'var(--ink-muted)',
          lineHeight: 1.6,
          borderTop: '1px solid var(--border)',
        }}
      >
        {summaryStatement}
      </p>
    </PanelShell>
  );
}
