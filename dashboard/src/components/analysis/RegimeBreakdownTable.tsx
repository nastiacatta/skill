/**
 * Regime breakdown table — compact display of per-regime statistics.
 *
 * Requirements: 5.3, 5.4, 5.5
 */

import type { RegimeStats } from '../../lib/analysis/types';
import PanelShell from './PanelShell';

interface RegimeBreakdownTableProps {
  regimes: RegimeStats[];
}

export default function RegimeBreakdownTable({ regimes }: RegimeBreakdownTableProps) {
  if (regimes.length === 0) {
    return (
      <PanelShell
        title="Regime breakdown"
        accent="var(--teal)"
        padding={14}
        emptyState="No regime data available."
      />
    );
  }

  return (
    <PanelShell title="Regime breakdown" accent="var(--teal)">
      <div
        className="overflow-x-auto"
        style={{ border: '1px solid var(--border)', borderRadius: 4 }}
      >
        <table className="w-full" style={{ fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)' }}>
              {[
                ['Regime',     'left',  '10px 12px'],
                ['n',          'right', '10px 8px'],
                ['Mean ΔCRPS', 'right', '10px 8px'],
                ['SE',         'right', '10px 8px'],
                ['95% CI',     'right', '10px 12px'],
              ].map(([label, align, pad]) => (
                <th
                  key={label}
                  className={`uppercase text-${align}`}
                  style={{
                    padding: pad,
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: 'var(--ink-soft)',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regimes.map((regime, i) => {
              const isLast = i === regimes.length - 1;
              const sign =
                regime.meanDeltaCrps < 0
                  ? 'var(--teal-deep)'
                  : regime.meanDeltaCrps > 0
                  ? 'var(--crimson)'
                  : 'var(--ink-muted)';
              return (
                <tr
                  key={regime.regimeName}
                  style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
                >
                  <td
                    style={{ padding: '8px 12px', color: 'var(--ink)', fontWeight: 500 }}
                  >
                    {regime.regimeName}
                  </td>
                  <td
                    className="text-right font-mono tabular-nums"
                    style={{ padding: '8px', color: 'var(--ink-muted)' }}
                  >
                    {regime.nRounds}
                  </td>
                  <td
                    className="text-right font-mono tabular-nums"
                    style={{ padding: '8px', color: sign, fontWeight: 600 }}
                  >
                    {regime.meanDeltaCrps.toFixed(4)}
                  </td>
                  <td
                    className="text-right font-mono tabular-nums"
                    style={{ padding: '8px', color: 'var(--ink-muted)' }}
                  >
                    {regime.se.toFixed(4)}
                  </td>
                  <td
                    className="text-right font-mono tabular-nums whitespace-nowrap"
                    style={{ padding: '8px 12px', color: 'var(--ink-muted)' }}
                  >
                    [{regime.ciLow.toFixed(4)}, {regime.ciHigh.toFixed(4)}]
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}
