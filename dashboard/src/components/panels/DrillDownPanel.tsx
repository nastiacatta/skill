import { useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fmt } from '@/components/lab/shared';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface DrillDownPanelProps {
  roundIndex?: number;
  sweepConfig?: { lam: number; sigmaMin: number };
  data: Record<string, unknown>;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

/* ── Round-replay pipeline steps ───────────────────────────────────── */

const PIPELINE_STEPS = [
  'deposit',
  'skillGate',
  'wager',
  'weight',
  'aggregate',
  'score',
  'settlement',
] as const;

const STEP_LABELS: Record<(typeof PIPELINE_STEPS)[number], string> = {
  deposit: 'Deposit (bᵢ)',
  skillGate: 'Skill Gate (σᵢ)',
  wager: 'Wager (mᵢ)',
  weight: 'Weight (wᵢ)',
  aggregate: 'Aggregate',
  score: 'Score (sᵢ)',
  settlement: 'Settlement (Πᵢ)',
};

/* ── Close icon ────────────────────────────────────────────────────── */

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

/* ── Navigation arrow icons ────────────────────────────────────────── */

function ChevronLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 010 1.06L8.06 10l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────── */

function formatValue(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'number') return fmt(v, 4);
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Extract per-agent metric arrays from the data record for a given round */
function extractAgentMetrics(data: Record<string, unknown>): Array<{
  agent: number;
  deposit: string;
  wager: string;
  weight: string;
  score: string;
  payoff: string;
}> {
  const agents = data['agents'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(agents)) return [];
  return agents.map((a, i) => ({
    agent: i,
    deposit: formatValue(a['deposit'] ?? a['b']),
    wager: formatValue(a['wager'] ?? a['m'] ?? a['effectiveWager']),
    weight: formatValue(a['weight'] ?? a['w']),
    score: formatValue(a['score'] ?? a['s']),
    payoff: formatValue(a['payoff'] ?? a['Pi']),
  }));
}

/** Extract pipeline step values from data for the mini round-replay */
function extractPipelineValues(data: Record<string, unknown>): Record<string, string> {
  return {
    deposit: formatValue(data['deposit'] ?? data['deposits'] ?? data['b']),
    skillGate: formatValue(data['skillGate'] ?? data['sigma'] ?? data['skill']),
    wager: formatValue(data['wager'] ?? data['wagers'] ?? data['m']),
    weight: formatValue(data['weight'] ?? data['weights'] ?? data['w']),
    aggregate: formatValue(data['aggregate'] ?? data['aggregateForecast'] ?? data['qBar']),
    score: formatValue(data['score'] ?? data['scores'] ?? data['s']),
    settlement: formatValue(data['settlement'] ?? data['payoffs'] ?? data['Pi']),
  };
}

/* ── Section wrapper ───────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{title}</h4>
      {children}
    </div>
  );
}

/* ── Round detail view ─────────────────────────────────────────────── */

function RoundDetailView({ roundIndex, data }: { roundIndex: number; data: Record<string, unknown> }) {
  const agentMetrics = extractAgentMetrics(data);
  const pipelineValues = extractPipelineValues(data);

  return (
    <>
      {/* Summary metrics */}
      <Section title="Round summary">
        <div className="grid grid-cols-2 gap-2">
          {(['aggregate', 'outcome'] as const).map((key) => {
            const val = data[key];
            return (
              <div key={key} className="bg-slate-50 rounded-lg p-2">
                <p className="text-xs text-slate-400 capitalize">{key}</p>
                <p className="text-sm font-mono font-semibold text-slate-800">{formatValue(val)}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Per-agent table */}
      {agentMetrics.length > 0 && (
        <Section title="Per-agent metrics">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-1 pr-2 text-slate-500 font-medium">Agent</th>
                  <th className="text-right py-1 px-1 text-slate-500 font-medium">bᵢ</th>
                  <th className="text-right py-1 px-1 text-slate-500 font-medium">mᵢ</th>
                  <th className="text-right py-1 px-1 text-slate-500 font-medium">wᵢ</th>
                  <th className="text-right py-1 px-1 text-slate-500 font-medium">sᵢ</th>
                  <th className="text-right py-1 pl-1 text-slate-500 font-medium">Πᵢ</th>
                </tr>
              </thead>
              <tbody>
                {agentMetrics.map((a) => (
                  <tr key={a.agent} className="border-b border-slate-100">
                    <td className="py-1 pr-2 text-slate-700 font-medium">F{a.agent + 1}</td>
                    <td className="py-1 px-1 text-right font-mono text-slate-600">{a.deposit}</td>
                    <td className="py-1 px-1 text-right font-mono text-slate-600">{a.wager}</td>
                    <td className="py-1 px-1 text-right font-mono text-slate-600">{a.weight}</td>
                    <td className="py-1 px-1 text-right font-mono text-slate-600">{a.score}</td>
                    <td className="py-1 pl-1 text-right font-mono text-slate-600">{a.payoff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Mini round-replay stepper */}
      <Section title={`Round ${roundIndex} replay`}>
        <div className="relative pl-4">
          {/* Vertical connector line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" />

          {PIPELINE_STEPS.map((step, i) => (
            <div key={step} className="relative flex items-start gap-3 mb-3 last:mb-0">
              {/* Step dot */}
              <div
                className="relative z-10 w-3.5 h-3.5 rounded-full border-2 border-indigo-400 bg-white flex-shrink-0 mt-0.5"
                style={i === PIPELINE_STEPS.length - 1 ? { borderColor: '#10b981', backgroundColor: '#ecfdf5' } : undefined}
              />
              {/* Step content */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700">{STEP_LABELS[step]}</p>
                <p className="text-xs font-mono text-slate-500 truncate">{pipelineValues[step]}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

/* ── Sweep config detail view ──────────────────────────────────────── */

function SweepConfigView({ sweepConfig, data }: { sweepConfig: { lam: number; sigmaMin: number }; data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([k]) => k !== 'agents');

  return (
    <>
      <Section title="Sweep configuration">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-indigo-50 rounded-lg p-2">
            <p className="text-xs text-indigo-400">λ (lambda)</p>
            <p className="text-sm font-mono font-semibold text-indigo-800">{fmt(sweepConfig.lam, 3)}</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-2">
            <p className="text-xs text-indigo-400">σ_min</p>
            <p className="text-sm font-mono font-semibold text-indigo-800">{fmt(sweepConfig.sigmaMin, 3)}</p>
          </div>
        </div>
      </Section>

      <Section title="Simulation summary">
        <div className="space-y-1.5">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-slate-500 truncate">{key}</span>
              <span className="text-xs font-mono text-slate-700 flex-shrink-0">{formatValue(value)}</span>
            </div>
          ))}
          {entries.length === 0 && (
            <p className="text-xs text-slate-400 italic">No summary data available</p>
          )}
        </div>
      </Section>
    </>
  );
}

/* ── DrillDownPanel ────────────────────────────────────────────────── */

export default function DrillDownPanel({
  roundIndex,
  sweepConfig,
  data,
  onClose,
  onNavigate,
}: DrillDownPanelProps) {
  /* Escape key dismiss */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  /* Arrow key navigation */
  useEffect(() => {
    if (!onNavigate) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigate('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigate('next');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onNavigate]);

  /* Prevent body scroll while panel is open */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const title = roundIndex != null
    ? `Round ${roundIndex}`
    : sweepConfig
      ? `λ=${fmt(sweepConfig.lam, 2)}, σ_min=${fmt(sweepConfig.sigmaMin, 2)}`
      : 'Detail';

  const hasNoData = Object.keys(data).length === 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Drill-down panel: ${title}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 transition-opacity duration-200"
        onClick={handleBackdropClick}
      />

      {/* Slide-out panel */}
      <div
        className="absolute top-0 right-0 h-full w-[400px] max-w-full bg-white shadow-xl flex flex-col"
        style={{
          animation: 'slideInFromRight 200ms ease-out forwards',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Navigation arrows for round mode */}
            {roundIndex != null && onNavigate && (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onNavigate('prev')}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                  aria-label="Previous round"
                  style={{ minWidth: '28px', minHeight: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('next')}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                  aria-label="Next round"
                  style={{ minWidth: '28px', minHeight: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronRightIcon />
                </button>
              </div>
            )}
            <h3 className="text-sm font-semibold text-slate-800 truncate">{title}</h3>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
            aria-label="Close panel"
            style={{ minWidth: '32px', minHeight: '32px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {hasNoData ? (
            <p className="text-sm text-slate-400 italic text-center mt-8">
              {roundIndex != null ? 'Round not found' : 'No data available'}
            </p>
          ) : roundIndex != null ? (
            <RoundDetailView roundIndex={roundIndex} data={data} />
          ) : sweepConfig ? (
            <SweepConfigView sweepConfig={sweepConfig} data={data} />
          ) : (
            /* Fallback: render all data keys */
            <Section title="Data">
              <div className="space-y-1.5">
                {Object.entries(data).map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-2">
                    <span className="text-xs text-slate-500 truncate">{key}</span>
                    <span className="text-xs font-mono text-slate-700 flex-shrink-0">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Footer hint */}
        {roundIndex != null && onNavigate && (
          <div className="px-4 py-2 border-t border-slate-100 flex-shrink-0">
            <p className="text-xs text-slate-400 text-center">
              ← → arrow keys to navigate rounds
            </p>
          </div>
        )}
      </div>

      {/* Slide-in animation keyframes */}
      <style>{`
        @keyframes slideInFromRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
