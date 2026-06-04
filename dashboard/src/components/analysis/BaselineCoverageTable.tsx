/**
 * Baseline coverage audit table (academic redesign).
 *
 * Experiments as rows, mandatory baselines as columns.
 * Checkmark for present, cross for missing.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.5, 7.6
 */

import type { BaselineCoverageEntry } from '../../lib/analysis/types';
import { MANDATORY_BASELINES } from '../../lib/analysis/baselineCoverage';
import PanelShell from './PanelShell';

interface BaselineCoverageTableProps {
  entries: BaselineCoverageEntry[];
}

function CheckIcon() {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full"
      style={{
        width: 20,
        height: 20,
        background: 'var(--teal-tint)',
        color: 'var(--teal-deep)',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3.5 8.5L6.5 11.5L12.5 4.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function CrossIcon() {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full"
      style={{
        width: 20,
        height: 20,
        background: 'var(--amber-tint)',
        color: '#78350f',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M4 4L12 12M12 4L4 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function StatusPill({ complete }: { complete: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: complete ? 'var(--teal-tint)' : 'var(--amber-tint)',
        color: complete ? 'var(--teal-deep)' : '#78350f',
        border: `1px solid ${complete ? 'rgba(15,118,110,0.25)' : 'rgba(180,83,9,0.3)'}`,
      }}
    >
      <span
        aria-hidden="true"
        className="inline-block rounded-full"
        style={{
          width: 6,
          height: 6,
          background: complete ? 'var(--teal)' : 'var(--amber)',
        }}
      />
      {complete ? 'Full baseline coverage' : 'Partial'}
    </span>
  );
}

export default function BaselineCoverageTable({ entries }: BaselineCoverageTableProps) {
  if (entries.length === 0) {
    return (
      <PanelShell title="Baseline coverage" emptyState="No experiments to audit." />
    );
  }

  const allComplete = entries.every((e) => e.isComplete);

  return (
    <PanelShell title="Baseline coverage" right={<StatusPill complete={allComplete} />}>
      <div
        className="overflow-x-auto"
        style={{
          borderRadius: 4,
          border: '1px solid var(--border)',
          background: 'var(--paper)',
        }}
      >
        <table className="w-full" style={{ fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
              <th
                className="text-left"
                style={{
                  padding: '10px 12px',
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--ink-soft)',
                }}
              >
                Experiment
              </th>
              {MANDATORY_BASELINES.map((b) => (
                <th
                  key={b}
                  className="text-center"
                  style={{
                    padding: '10px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--ink-soft)',
                  }}
                >
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr
                key={entry.experimentName}
                style={{
                  borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                <td
                  style={{
                    padding: '10px 12px',
                    color: 'var(--ink-muted)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.experimentName}
                  {!entry.isComplete && (
                    <span
                      className="ml-2"
                      style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 500 }}
                    >
                      Missing baselines
                    </span>
                  )}
                </td>
                {MANDATORY_BASELINES.map((baseline) => {
                  const present = entry.presentBaselines.includes(baseline);
                  return (
                    <td
                      key={baseline}
                      className="text-center"
                      style={{ padding: '10px 8px' }}
                    >
                      {present ? <CheckIcon /> : <CrossIcon />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PanelShell>
  );
}
