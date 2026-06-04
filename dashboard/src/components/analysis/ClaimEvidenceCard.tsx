/**
 * Claim-evidence traceability card (academic redesign).
 *
 * Displays a thesis claim alongside its supporting evidence:
 * metric value with CI, effect size label, conditions, caveat,
 * and live validation status from the ClaimValidator.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import type {
  EnrichedThesisClaim,
  ClaimValidationResult,
  EffectSizeResult,
} from '../../lib/analysis/types';

interface ClaimEvidenceCardProps {
  claim: EnrichedThesisClaim;
  validation: ClaimValidationResult | null;
  effectSize: EffectSizeResult | null;
}

type StatusKey = 'valid' | 'stale' | 'contradicted' | 'unverifiable';

type StatusCfg = {
  rule: string;
  tint: string;
  iconBg: string;
  label: string;
  labelColor: string;
  iconPath: React.ReactNode;
};

const STATUS_CONFIG: Record<StatusKey, StatusCfg> = {
  valid: {
    rule: 'var(--teal)',
    tint: 'var(--teal-tint)',
    iconBg: 'var(--teal)',
    label: 'Supported by data',
    labelColor: 'var(--teal-deep)',
    iconPath: (
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  stale: {
    rule: 'var(--amber)',
    tint: 'var(--amber-tint)',
    iconBg: 'var(--amber)',
    label: 'Data has changed — verify',
    labelColor: '#78350f',
    iconPath: (
      <>
        <path d="M8 2L1.5 13.5H14.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 7V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
      </>
    ),
  },
  contradicted: {
    rule: 'var(--crimson)',
    tint: 'var(--crimson-tint)',
    iconBg: 'var(--crimson)',
    label: 'Contradicted by data',
    labelColor: '#6a1221',
    iconPath: (
      <>
        <path d="M4 4L12 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M12 4L4 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </>
    ),
  },
  unverifiable: {
    rule: 'var(--ink-faint)',
    tint: 'var(--cream)',
    iconBg: 'var(--ink-faint)',
    label: 'Data not available',
    labelColor: 'var(--ink-soft)',
    iconPath: (
      <>
        <path d="M6 6a2 2 0 114 0c0 1-2 1.5-2 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="12" r="0.75" fill="currentColor" />
      </>
    ),
  },
};

const EFFECT_CONFIG: Record<
  string,
  { bg: string; fg: string; border: string }
> = {
  negligible: { bg: 'var(--cream)',    fg: 'var(--ink-soft)',   border: 'var(--border)' },
  small:      { bg: 'var(--navy-tint)', fg: 'var(--navy)',       border: 'rgba(29,52,97,0.22)' },
  medium:     { bg: 'var(--amber-tint)', fg: '#78350f',          border: 'rgba(180,83,9,0.25)' },
  large:      { bg: 'var(--teal-tint)', fg: 'var(--teal-deep)',  border: 'rgba(15,118,110,0.25)' },
};

function chip(text: string) {
  return (
    <span
      style={{
        fontSize: 10.5,
        padding: '2px 6px',
        borderRadius: 3,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        color: 'var(--ink-soft)',
        fontWeight: 500,
      }}
    >
      {text}
    </span>
  );
}

export default function ClaimEvidenceCard({
  claim,
  validation,
  effectSize,
}: ClaimEvidenceCardProps) {
  const status: StatusKey = validation?.status ?? 'unverifiable';
  const config = STATUS_CONFIG[status];
  const effect =
    effectSize && EFFECT_CONFIG[effectSize.label]
      ? EFFECT_CONFIG[effectSize.label]
      : EFFECT_CONFIG.negligible;

  return (
    <div
      className="transition-colors duration-150"
      style={{
        background: 'var(--card)',
        borderLeft: `3px solid ${config.rule}`,
        border: '1px solid var(--border)',
        borderLeftWidth: 3,
        borderLeftColor: config.rule,
        borderRadius: 4,
        padding: 18,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header: title + status */}
      <div className="flex items-start justify-between gap-3">
        <h3
          className="font-serif tracking-tight"
          style={{
            fontSize: 15.5,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.35,
          }}
        >
          {claim.title}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center"
            style={{
              width: 20, height: 20, borderRadius: '50%',
              background: config.iconBg, color: '#fff',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              {config.iconPath}
            </svg>
          </span>
          <span
            style={{ fontSize: 11.5, fontWeight: 600, color: config.labelColor }}
          >
            {config.label}
          </span>
        </div>
      </div>

      {/* Metric + effect size */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className="font-mono tabular-nums"
          style={{
            fontSize: 11.5,
            background: 'var(--cream)',
            border: '1px solid var(--border)',
            padding: '2px 7px',
            borderRadius: 3,
            color: 'var(--ink-muted)',
          }}
        >
          {claim.metric}
        </span>
        {effectSize && (
          <span
            className="font-medium"
            style={{
              fontSize: 11.5,
              padding: '2px 7px',
              borderRadius: 3,
              background: effect.bg,
              color: effect.fg,
              border: `1px solid ${effect.border}`,
            }}
          >
            d = {effectSize.cohensD.toFixed(2)} ({effectSize.label})
          </span>
        )}
      </div>

      {/* Discrepancy detail */}
      {validation && status === 'stale' && validation.discrepancyPct != null && (
        <p
          className="mt-3"
          style={{
            fontSize: 12,
            color: '#78350f',
            background: 'var(--amber-tint)',
            border: '1px solid rgba(180,83,9,0.18)',
            padding: '6px 10px',
            borderRadius: 3,
          }}
        >
          Discrepancy: {validation.discrepancyPct.toFixed(1)}% (computed{' '}
          {validation.computedValue?.toFixed(4)} vs stated {validation.statedValue})
        </p>
      )}
      {validation && status === 'contradicted' && (
        <p
          className="mt-3"
          style={{
            fontSize: 12,
            color: '#6a1221',
            background: 'var(--crimson-tint)',
            border: '1px solid rgba(154,26,47,0.18)',
            padding: '6px 10px',
            borderRadius: 3,
          }}
        >
          Computed: {validation.computedValue?.toFixed(4)} — expected{' '}
          {claim.evidence.expected_sign} sign
        </p>
      )}

      {/* Conditions */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {claim.conditions.dgp && chip(`DGP: ${claim.conditions.dgp}`)}
        {chip(`N = ${claim.conditions.n_forecasters}`)}
        {chip(`T = ${claim.conditions.T}`)}
        {chip(claim.conditions.deposit_policy)}
        {chip(`${claim.conditions.n_seeds} seeds`)}
      </div>

      {/* Caveat */}
      {claim.caveat && (
        <p
          className="italic mt-3"
          style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}
        >
          {claim.caveat}
        </p>
      )}

      {/* View evidence link */}
      <div className="mt-4">
        <a
          href={`#experiment-${claim.experimentName}`}
          className="inline-flex items-center gap-1 transition-colors group"
          style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)' }}
        >
          View evidence
          <svg
            width="10" height="10" viewBox="0 0 16 16" fill="none"
            aria-hidden="true"
            className="transition-transform group-hover:translate-x-0.5"
          >
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </div>
  );
}
