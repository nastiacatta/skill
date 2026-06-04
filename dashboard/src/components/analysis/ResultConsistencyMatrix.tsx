/**
 * Cross-experiment result consistency matrix.
 *
 * Table with experiments as rows, methods as columns, cells showing
 * rank number with colour coding. Kendall's W badge in header.
 * Contradiction tooltips on hover.
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5, 13.3, 13.4, 13.5
 */

import type { ConsistencyResult } from '../../lib/analysis/types';
import PanelShell from './PanelShell';

interface ResultConsistencyMatrixProps {
  result: ConsistencyResult;
}

function rankColor(rank: number, totalMethods: number): string {
  if (rank === 1) return 'bg-teal-50 text-teal-800 border-teal-200';
  if (rank === totalMethods) return 'bg-red-50 text-red-800 border-red-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

export default function ResultConsistencyMatrix({ result }: ResultConsistencyMatrixProps) {
  const { matrix, kendallW, isConsistent, contradictions } = result;

  // Extract unique experiments and methods
  const experiments = [...new Set(matrix.map((r) => r.experiment))];
  const methods = [...new Set(matrix.map((r) => r.method))].sort();

  // Build lookup: experiment → method → rank
  const rankLookup = new Map<string, Map<string, number>>();
  for (const entry of matrix) {
    if (!rankLookup.has(entry.experiment)) rankLookup.set(entry.experiment, new Map());
    rankLookup.get(entry.experiment)!.set(entry.method, entry.rank);
  }

  // Build contradiction lookup for tooltips
  const contradictionsByCell = new Map<string, string[]>();
  for (const c of contradictions) {
    for (const exp of [c.experimentA, c.experimentB]) {
      for (const method of [c.methodA, c.methodB]) {
        const key = `${exp}:${method}`;
        if (!contradictionsByCell.has(key)) contradictionsByCell.set(key, []);
        contradictionsByCell.get(key)!.push(c.description);
      }
    }
  }

  return (
    <PanelShell
      title="Method ranking consistency"
      accent="var(--teal)"
      right={
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="inline-flex items-center gap-1 font-mono tabular-nums"
            style={{
              fontSize: 11.5,
              color: 'var(--ink)',
              background: 'var(--cream)',
              border: '1px solid var(--border)',
              padding: '3px 8px',
              borderRadius: 4,
            }}
          >
            <span style={{ color: 'var(--ink-faint)' }}>W</span>
            <span style={{ fontWeight: 700 }}>{kendallW.toFixed(3)}</span>
          </span>
          <span
            className="inline-flex items-center gap-1.5"
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 999,
              background: isConsistent ? 'var(--teal-tint)' : 'var(--amber-tint)',
              color:      isConsistent ? 'var(--teal-deep)' : '#78350f',
              border: `1px solid ${isConsistent ? 'rgba(15,118,110,0.22)' : 'rgba(180,83,9,0.22)'}`,
            }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: isConsistent ? 'var(--teal)' : 'var(--amber)' }}
            />
            {isConsistent ? 'Consistent' : 'Unstable rankings'}
          </span>
        </div>
      }
    >
      <p
        style={{
          fontSize: 12.5,
          color: 'var(--ink-soft)',
          lineHeight: 1.55,
          maxWidth: 720,
          marginTop: -4,
          marginBottom: 12,
        }}
      >
        Kendall&apos;s W measures how consistently different experiments rank the methods.
        1 = perfect agreement, 0 = no agreement.
      </p>

      {/* Table */}
      <div
        className="overflow-x-auto"
        style={{ border: '1px solid var(--border)', borderRadius: 4 }}
      >
        <table className="w-full" style={{ fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--cream)', borderBottom: '1px solid var(--border)' }}>
              <th
                className="text-left uppercase"
                style={{
                  padding: '10px 12px', fontSize: 10.5, fontWeight: 700,
                  letterSpacing: '0.1em', color: 'var(--ink-soft)',
                }}
              >
                Experiment
              </th>
              {methods.map((m) => (
                <th
                  key={m}
                  className="text-center uppercase"
                  style={{
                    padding: '10px 8px', fontSize: 10.5, fontWeight: 700,
                    letterSpacing: '0.1em', color: 'var(--ink-soft)',
                  }}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {experiments.map((exp, i) => (
              <tr
                key={exp}
                style={{ borderBottom: i < experiments.length - 1 ? '1px solid var(--border)' : 'none' }}
              >
                <td
                  className="font-medium whitespace-nowrap"
                  style={{ padding: '8px 12px', color: 'var(--ink)' }}
                >
                  {exp}
                </td>
                {methods.map((method) => {
                  const rank = rankLookup.get(exp)?.get(method);
                  const cellKey = `${exp}:${method}`;
                  const cellContradictions = contradictionsByCell.get(cellKey);
                  const hasContradiction = cellContradictions && cellContradictions.length > 0;

                  return (
                    <td key={method} className="text-center" style={{ padding: '8px' }}>
                      {rank != null ? (
                        <span
                          className={`inline-flex items-center justify-center font-mono tabular-nums ${rankColor(rank, methods.length)}`}
                          style={{
                            width: 26, height: 26,
                            fontSize: 12, fontWeight: 700,
                            borderRadius: 4,
                            boxShadow: hasContradiction ? '0 0 0 2px var(--amber)' : 'none',
                            border: '1px solid',
                          }}
                          title={hasContradiction ? cellContradictions!.join('\n') : `Rank ${rank}`}
                        >
                          {rank}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Contradictions summary */}
      {contradictions.length > 0 && (
        <div
          className="mt-4 p-3"
          style={{
            background: 'var(--amber-tint)',
            border: '1px solid rgba(180,83,9,0.22)',
            borderLeft: '3px solid var(--amber)',
            borderRadius: 4,
          }}
        >
          <p
            className="mb-1.5 flex items-center gap-1.5"
            style={{ fontSize: 12, color: '#78350f', fontWeight: 600 }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2L1.5 13.5H14.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8 7V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="12" r="0.75" fill="currentColor" />
            </svg>
            {contradictions.length} contradiction{contradictions.length > 1 ? 's' : ''} detected
          </p>
          <ul
            className="space-y-1 pl-5 list-disc"
            style={{ fontSize: 12, color: '#5c2a07', lineHeight: 1.55 }}
          >
            {contradictions.slice(0, 3).map((c, i) => (
              <li key={i}>{c.description}</li>
            ))}
            {contradictions.length > 3 && (
              <li
                className="list-none italic"
                style={{ fontSize: 11, color: 'var(--amber)' }}
              >
                … and {contradictions.length - 3} more
              </li>
            )}
          </ul>
        </div>
      )}
    </PanelShell>
  );
}
