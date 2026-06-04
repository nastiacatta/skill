/**
 * Panel size sensitivity chart (academic redesign).
 *
 * Requirements: 10.1, 10.2, 10.3
 */

import type { PanelSweepResult } from '../../lib/analysis/types';
import PanelShell from './PanelShell';

interface PanelSizeChartProps {
  sweep: PanelSweepResult;
}

export default function PanelSizeChart({ sweep }: PanelSizeChartProps) {
  const { results, minimumReliableN } = sweep;

  if (results.length === 0) {
    return (
      <PanelShell title="Panel size sensitivity" accent="var(--navy)" emptyState="No panel sweep data available." />
    );
  }

  const maxAbs = Math.max(
    ...results.map((r) => Math.max(Math.abs(r.ciLow), Math.abs(r.ciHigh))),
    0.001,
  );

  const hasMinN = minimumReliableN != null;

  return (
    <PanelShell title="Panel size sensitivity" accent="var(--navy)">
      <div
        className="mb-4 flex gap-2.5 p-3"
        style={{
          background: hasMinN ? 'var(--teal-tint)' : 'var(--amber-tint)',
          border: `1px solid ${hasMinN ? 'rgba(15,118,110,0.22)' : 'rgba(180,83,9,0.22)'}`,
          borderLeft: `3px solid ${hasMinN ? 'var(--teal)' : 'var(--amber)'}`,
          borderRadius: 4,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: hasMinN ? 'var(--teal-deep)' : '#78350f',
            }}
          >
            {hasMinN ? `Minimum reliable N = ${minimumReliableN}` : 'No reliable N found'}
          </p>
          <p
            style={{
              fontSize: 12.5,
              color: hasMinN ? '#194c48' : '#5c2a07',
              marginTop: 3,
              lineHeight: 1.55,
            }}
          >
            {hasMinN
              ? `The mechanism reliably beats equal weighting (95% CI entirely below zero) at N ≥ ${minimumReliableN}.`
              : 'At no tested panel size does the 95% CI for ΔCRPS lie entirely below zero.'}
          </p>
        </div>
      </div>

      <div
        className="overflow-x-auto"
        style={{ border: '1px solid var(--border)', borderRadius: 4 }}
      >
        <table className="w-full" style={{ fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)' }}>
              {[
                ['N',         'left',   '10px 14px'],
                ['Mean ΔCRPS','right',  '10px 8px'],
                ['SE',        'right',  '10px 8px'],
                ['95% CI',    'right',  '10px 8px'],
                ['CI range',  'center', '10px 8px'],
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
                    minWidth: label === 'CI range' ? 140 : undefined,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => {
              const isReliable = r.ciHigh < 0;
              const isMinReliable = r.n === minimumReliableN;
              const barLeft = ((r.ciLow / maxAbs + 1) / 2) * 100;
              const barRight = ((r.ciHigh / maxAbs + 1) / 2) * 100;
              const barWidth = Math.max(barRight - barLeft, 1);
              const rowBg = isMinReliable ? 'var(--teal-tint)' : 'transparent';

              return (
                <tr
                  key={r.n}
                  style={{
                    background: rowBg,
                    borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <td
                    className="font-mono tabular-nums"
                    style={{ padding: '8px 14px', fontWeight: 600, color: 'var(--ink)' }}
                  >
                    {r.n}
                    {isMinReliable && (
                      <span className="ml-1" style={{ fontSize: 10.5, color: 'var(--teal-deep)' }}>✓</span>
                    )}
                  </td>
                  <td
                    className="text-right font-mono tabular-nums"
                    style={{
                      padding: '8px',
                      color: isReliable ? 'var(--teal-deep)' : 'var(--ink-muted)',
                      fontWeight: isReliable ? 600 : 500,
                    }}
                  >
                    {r.meanDeltaCrps.toFixed(4)}
                  </td>
                  <td
                    className="text-right font-mono tabular-nums"
                    style={{ padding: '8px', color: 'var(--ink-muted)' }}
                  >
                    {r.se.toFixed(4)}
                  </td>
                  <td
                    className="text-right font-mono tabular-nums whitespace-nowrap"
                    style={{ padding: '8px', color: 'var(--ink-muted)' }}
                  >
                    [{r.ciLow.toFixed(4)}, {r.ciHigh.toFixed(4)}]
                  </td>
                  <td style={{ padding: '8px' }}>
                    <div
                      className="relative"
                      style={{ height: 16, background: 'var(--border)', borderRadius: 3 }}
                    >
                      {/* Zero line */}
                      <div
                        className="absolute top-0 bottom-0 left-1/2"
                        style={{ width: 1, background: 'var(--ink-faint)', opacity: 0.6 }}
                      />
                      {/* CI bar */}
                      <div
                        className="absolute top-1 bottom-1"
                        style={{
                          background: isReliable ? 'var(--teal)' : 'var(--ink-soft)',
                          opacity: 0.75,
                          left: `${Math.max(barLeft, 0)}%`,
                          width: `${Math.min(barWidth, 100)}%`,
                          borderRadius: 3,
                        }}
                      />
                      {/* Mean dot */}
                      <div
                        className="absolute"
                        style={{
                          top: 5, width: 6, height: 6,
                          borderRadius: '50%',
                          background: isReliable ? 'var(--teal-deep)' : 'var(--ink)',
                          left: `${((r.meanDeltaCrps / maxAbs + 1) / 2) * 100}%`,
                          transform: 'translateX(-50%)',
                        }}
                      />
                    </div>
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
