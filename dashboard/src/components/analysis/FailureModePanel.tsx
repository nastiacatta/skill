/**
 * Failure mode documentation panel (academic redesign).
 *
 * Cards showing conditions where the mechanism underperforms equal weighting.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import type { FailureMode } from '../../lib/analysis/types';

interface FailureModePanelProps {
  failureModes: FailureMode[];
}

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 18,
  boxShadow: 'var(--shadow-sm)',
};

function PanelHeader({
  title,
  count,
  accent = 'var(--ink-faint)',
}: {
  title: string;
  count?: number;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-4 gap-3">
      <h3
        className="font-serif flex items-center gap-2.5 tracking-tight"
        style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}
      >
        <span
          aria-hidden="true"
          className="inline-block"
          style={{ width: 3, height: 16, background: accent, borderRadius: 2 }}
        />
        {title}
      </h3>
      {count != null && (
        <span
          className="inline-flex items-center font-mono tabular-nums px-2"
          style={{
            fontSize: 11,
            fontWeight: 600,
            background: 'var(--cream)',
            color: 'var(--ink-soft)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            padding: '2px 8px',
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

export default function FailureModePanel({ failureModes }: FailureModePanelProps) {
  if (failureModes.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <PanelHeader title="Limitations & failure modes" />
        <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No failure modes documented.</p>
      </div>
    );
  }

  return (
    <div style={CARD_STYLE}>
      <PanelHeader title="Limitations & failure modes" count={failureModes.length} />
      <div className="space-y-3">
        {failureModes.map((fm) => (
          <div
            key={fm.id}
            className="p-4"
            style={{
              background: 'var(--cream)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--ink-faint)',
              borderRadius: 4,
            }}
          >
            <p
              className="font-serif"
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}
            >
              {fm.condition}
            </p>

            {/* ΔCRPS with CI bar */}
            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <span
                className="font-mono tabular-nums"
                style={{
                  fontSize: 12,
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  padding: '2px 8px',
                  borderRadius: 3,
                  color: 'var(--ink-muted)',
                }}
              >
                ΔCRPS = {fm.deltaCrps.toFixed(4)}
              </span>
              <span
                className="font-mono tabular-nums"
                style={{ fontSize: 11, color: 'var(--ink-faint)' }}
              >
                [{fm.ciLow.toFixed(4)}, {fm.ciHigh.toFixed(4)}]
              </span>
              <div
                className="flex-1 max-w-[140px] relative"
                style={{ height: 4, background: 'var(--border-strong)', borderRadius: 4 }}
                title={`95% CI: [${fm.ciLow.toFixed(4)}, ${fm.ciHigh.toFixed(4)}]`}
              >
                <div
                  className="absolute h-full"
                  style={{
                    background: 'var(--ink-soft)',
                    borderRadius: 4,
                    left: `${Math.max(0, ((fm.ciLow + 0.1) / 0.2) * 100)}%`,
                    right: `${Math.max(0, 100 - ((fm.ciHigh + 0.1) / 0.2) * 100)}%`,
                  }}
                />
              </div>
            </div>

            <p
              className="mt-2.5"
              style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.55 }}
            >
              {fm.explanation}
            </p>

            <a
              href={`#experiment-${fm.experimentName}`}
              className="mt-2 inline-flex items-center gap-1 group"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--navy)' }}
            >
              See {fm.experimentName}
              <svg
                width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true"
                className="transition-transform group-hover:translate-x-0.5"
              >
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
