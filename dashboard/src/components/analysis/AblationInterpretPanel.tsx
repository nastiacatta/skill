/**
 * Ablation interpretation panel (academic redesign).
 *
 * Ranked list of pipeline steps with horizontal contribution bars.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */

import type { AblationInterpretation } from '../../lib/analysis/types';
import PanelShell from './PanelShell';

interface AblationInterpretPanelProps {
  interpretation: AblationInterpretation;
}

type ComplexityCfg = { bg: string; fg: string; border: string };
const COMPLEXITY: Record<string, ComplexityCfg> = {
  low:    { bg: 'var(--teal-tint)',    fg: 'var(--teal-deep)', border: 'rgba(15,118,110,0.22)' },
  medium: { bg: 'var(--amber-tint)',   fg: '#78350f',          border: 'rgba(180,83,9,0.22)'   },
  high:   { bg: 'var(--crimson-tint)', fg: '#6a1221',          border: 'rgba(154,26,47,0.22)'  },
};

export default function AblationInterpretPanel({
  interpretation,
}: AblationInterpretPanelProps) {
  const { steps, conclusion, skillGateThreat } = interpretation;

  if (steps.length === 0) {
    return (
      <PanelShell
        title="Ablation interpretation"
        accent="var(--plum)"
        emptyState="No ablation data available."
      />
    );
  }

  const maxContribution = Math.max(
    ...steps.map((s) => Math.abs(s.deltaCrpsContribution)),
    0.001,
  );

  return (
    <PanelShell title="Ablation interpretation" accent="var(--plum)">
      {skillGateThreat && (
        <div
          className="mb-4 flex gap-2.5 p-3"
          style={{
            background: 'var(--amber-tint)',
            border: '1px solid rgba(180,83,9,0.22)',
            borderLeft: '3px solid var(--amber)',
            borderRadius: 4,
          }}
        >
          <span
            aria-hidden="true"
            className="shrink-0 inline-flex items-center justify-center mt-0.5"
            style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', border: '1.5px solid var(--amber)', color: 'var(--amber)' }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L1.5 13.5H14.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M8 7V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="12" r="0.75" fill="currentColor" />
            </svg>
          </span>
          <p style={{ fontSize: 12.5, color: '#78350f', fontWeight: 500, lineHeight: 1.55 }}>
            Skill gate threat: removing the skill gate (step C) has negligible
            effect on accuracy. This challenges the claim that skill improves accuracy.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const barWidth =
            (Math.abs(step.deltaCrpsContribution) / maxContribution) * 100;
          const isPositive = step.deltaCrpsContribution > 0;
          const barColor = step.isNegligible
            ? 'var(--ink-faint)'
            : isPositive
            ? 'var(--navy)'
            : 'var(--crimson)';
          const complexityCfg = COMPLEXITY[step.complexityLevel] ?? COMPLEXITY.medium;

          return (
            <div
              key={step.variant}
              className="flex items-center gap-3 py-2 px-2 -mx-2 transition-colors"
              style={{ borderRadius: 4 }}
            >
              <span
                className="inline-flex items-center justify-center font-mono tabular-nums shrink-0"
                style={{
                  width: 22, height: 22,
                  borderRadius: 4,
                  background: 'var(--cream)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--ink-soft)',
                }}
              >
                {i + 1}
              </span>

              <div className="w-28 shrink-0">
                <p
                  className="font-serif"
                  style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}
                >
                  {step.label}
                </p>
                <p
                  className="font-mono"
                  style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 1 }}
                >
                  {step.variant}
                </p>
              </div>

              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div
                  className="flex-1 relative overflow-hidden"
                  style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}
                >
                  <div
                    className="absolute top-0 left-0 h-full transition-all duration-300"
                    style={{
                      background: barColor,
                      width: `${Math.max(barWidth, 2)}%`,
                      borderRadius: 3,
                    }}
                  />
                </div>
                <span
                  className="font-mono tabular-nums shrink-0 text-right"
                  style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 600, width: 68 }}
                >
                  {step.deltaCrpsContribution >= 0 ? '+' : ''}
                  {step.deltaCrpsContribution.toFixed(4)}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {step.isNegligible && (
                  <span
                    style={{
                      fontSize: 10,
                      background: 'var(--cream)',
                      color: 'var(--ink-soft)',
                      border: '1px solid var(--border)',
                      padding: '2px 6px',
                      borderRadius: 3,
                      fontWeight: 500,
                    }}
                  >
                    no impact
                  </span>
                )}
                <span
                  className="capitalize"
                  style={{
                    fontSize: 10,
                    background: complexityCfg.bg,
                    color: complexityCfg.fg,
                    border: `1px solid ${complexityCfg.border}`,
                    padding: '2px 6px',
                    borderRadius: 3,
                    fontWeight: 500,
                  }}
                >
                  {step.complexityLevel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p
        className="mt-4 pt-4"
        style={{
          fontSize: 13,
          color: 'var(--ink-muted)',
          lineHeight: 1.6,
          borderTop: '1px solid var(--border)',
        }}
      >
        {conclusion}
      </p>
    </PanelShell>
  );
}
