/**
 * Deposit interaction panel — displays per-policy ΔCRPS summaries
 * and the interaction effect between deposit policy and skill layer.
 *
 * Requirements: 8.1, 8.2, 8.3
 */

import type { InteractionAnalysis } from '../../lib/analysis/types';
import PanelShell from './PanelShell';

interface DepositInteractionPanelProps {
  analysis: InteractionAnalysis;
}

export default function DepositInteractionPanel({
  analysis,
}: DepositInteractionPanelProps) {
  const {
    perPolicy,
    interactionEffect,
    interactionSe,
    interactionCiLow,
    interactionCiHigh,
    interpretation,
    warning,
  } = analysis;

  return (
    <PanelShell title="Deposit policy × skill interaction" accent="var(--plum)">
      {warning && (
        <div
          className="mb-3"
          style={{
            background: 'var(--amber-tint)',
            border: '1px solid rgba(180,83,9,0.22)',
            borderLeft: '3px solid var(--amber)',
            padding: 10,
            borderRadius: 4,
          }}
        >
          <p style={{ fontSize: 12.5, color: '#78350f', fontWeight: 500 }}>⚠ {warning}</p>
        </div>
      )}

      {perPolicy.length > 0 && (
        <div
          className="mb-4 overflow-x-auto"
          style={{ border: '1px solid var(--border)', borderRadius: 4 }}
        >
          <table className="w-full" style={{ fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)' }}>
                <th
                  className="text-left uppercase"
                  style={{
                    padding: '8px 12px', fontSize: 10.5, fontWeight: 700,
                    letterSpacing: '0.1em', color: 'var(--ink-soft)',
                  }}
                >
                  Policy
                </th>
                <th
                  className="text-left uppercase"
                  style={{
                    padding: '8px', fontSize: 10.5, fontWeight: 700,
                    letterSpacing: '0.1em', color: 'var(--ink-soft)',
                  }}
                >
                  Method
                </th>
                <th
                  className="text-right uppercase"
                  style={{
                    padding: '8px', fontSize: 10.5, fontWeight: 700,
                    letterSpacing: '0.1em', color: 'var(--ink-soft)',
                  }}
                >
                  Mean ΔCRPS
                </th>
                <th
                  className="text-right uppercase"
                  style={{
                    padding: '8px', fontSize: 10.5, fontWeight: 700,
                    letterSpacing: '0.1em', color: 'var(--ink-soft)',
                  }}
                >
                  SE
                </th>
                <th
                  className="text-right uppercase"
                  style={{
                    padding: '8px', fontSize: 10.5, fontWeight: 700,
                    letterSpacing: '0.1em', color: 'var(--ink-soft)',
                  }}
                >
                  95% CI
                </th>
              </tr>
            </thead>
            <tbody>
              {perPolicy.map((row, i) => {
                const isLast = i === perPolicy.length - 1;
                const sign =
                  row.meanDeltaCrps < 0
                    ? 'var(--teal-deep)'
                    : row.meanDeltaCrps > 0
                    ? 'var(--crimson)'
                    : 'var(--ink-muted)';
                return (
                  <tr
                    key={`${row.depositPolicy}-${row.method}`}
                    style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
                  >
                    <td style={{ padding: '8px 12px', color: 'var(--ink)', fontWeight: 500 }}>
                      {row.depositPolicy}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--ink-muted)' }}>{row.method}</td>
                    <td
                      className="text-right font-mono tabular-nums"
                      style={{ padding: '8px', color: sign, fontWeight: 600 }}
                    >
                      {row.meanDeltaCrps.toFixed(4)}
                    </td>
                    <td
                      className="text-right font-mono tabular-nums"
                      style={{ padding: '8px', color: 'var(--ink-muted)' }}
                    >
                      {row.se.toFixed(4)}
                    </td>
                    <td
                      className="text-right font-mono tabular-nums whitespace-nowrap"
                      style={{ padding: '8px', color: 'var(--ink-muted)' }}
                    >
                      [{row.ciLow.toFixed(4)}, {row.ciHigh.toFixed(4)}]
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Interaction effect summary */}
      <div
        className="p-3"
        style={{
          background: 'var(--navy-tint)',
          border: '1px solid rgba(29,52,97,0.18)',
          borderLeft: '3px solid var(--navy)',
          borderRadius: 4,
        }}
      >
        <div className="flex items-baseline gap-3 flex-wrap mb-1">
          <span style={{ fontSize: 12, color: 'var(--ink-muted)', fontWeight: 600 }}>
            Interaction effect
          </span>
          <span
            className="font-mono tabular-nums"
            style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}
          >
            {interactionEffect >= 0 ? '+' : ''}
            {interactionEffect.toFixed(4)}
          </span>
          <span
            className="font-mono tabular-nums"
            style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}
          >
            SE = {interactionSe.toFixed(4)}, 95% CI [{interactionCiLow.toFixed(4)}, {interactionCiHigh.toFixed(4)}]
          </span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--ink-muted)', lineHeight: 1.55 }}>
          {interpretation}
        </p>
      </div>
    </PanelShell>
  );
}
