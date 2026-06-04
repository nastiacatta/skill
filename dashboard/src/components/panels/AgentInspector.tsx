import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { fmt } from '@/components/lab/shared';

/* ── Types ─────────────────────────────────────────────────────────── */

interface TimeSeriesPoint {
  t: number;
  value: number;
}

export interface AgentInspectorProps {
  agentId: number;
  data: {
    sigma: TimeSeriesPoint[];
    wealth: TimeSeriesPoint[];
    deposit: TimeSeriesPoint[];
    effectiveWager: TimeSeriesPoint[];
    score: TimeSeriesPoint[];
  };
  onClose: () => void;
}

/* ── Metric definitions ────────────────────────────────────────────── */

interface MetricDef {
  key: keyof AgentInspectorProps['data'];
  label: string;
  symbol: string;
  colour: string;
}

const METRICS: MetricDef[] = [
  { key: 'sigma',          label: 'Skill',            symbol: 'σ', colour: '#6366f1' },
  { key: 'wealth',         label: 'Wealth',           symbol: 'W', colour: '#0ea5e9' },
  { key: 'deposit',        label: 'Deposit',          symbol: 'b', colour: '#10b981' },
  { key: 'effectiveWager', label: 'Effective Wager',  symbol: 'm', colour: '#f59e0b' },
  { key: 'score',          label: 'Score',            symbol: 's', colour: '#ef4444' },
];

/* ── Close icon ────────────────────────────────────────────────────── */

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

/* ── Sparkline component ───────────────────────────────────────────── */

function Sparkline({
  data,
  colour,
  label,
  symbol,
}: {
  data: TimeSeriesPoint[];
  colour: string;
  label: string;
  symbol: string;
}) {
  const latestValue = data.length > 0 ? data[data.length - 1].value : null;

  return (
    <div className="mb-3" role="img" aria-label={`${label} sparkline for agent`}>
      {/* Label row */}
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-slate-500">
          <span className="font-mono font-medium text-slate-700" style={{ fontSize: '12px' }}>{symbol}</span>
          {' '}
          {label}
        </span>
        <span className="text-xs font-mono font-semibold text-slate-800">
          {latestValue != null ? fmt(latestValue, 4) : '—'}
        </span>
      </div>

      {/* Sparkline chart */}
      <div style={{ width: '100%', height: 60 }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={colour}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded">
            <span className="text-xs text-slate-300 italic">No data</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── AgentInspector ────────────────────────────────────────────────── */

export default function AgentInspector({
  agentId,
  data,
  onClose,
}: AgentInspectorProps) {
  /* Escape key dismiss */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

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

  const agentLabel = `F${agentId + 1}`;
  const hasAnyData = METRICS.some((m) => data[m.key].length > 0);

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={`Agent inspector: ${agentLabel}`}
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
            {/* Agent badge */}
            <span
              className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white flex-shrink-0"
              style={{ backgroundColor: '#6366f1' }}
            >
              {agentLabel}
            </span>
            <h3 className="text-sm font-semibold text-slate-800 truncate">
              Agent {agentLabel} Inspector
            </h3>
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
          {!hasAnyData ? (
            <p className="text-sm text-slate-400 italic text-center mt-8">
              No data available for this agent
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-4">
                Full state history across all rounds. Latest value shown on the right.
              </p>

              {METRICS.map((m) => (
                <Sparkline
                  key={m.key}
                  data={data[m.key]}
                  colour={m.colour}
                  label={m.label}
                  symbol={m.symbol}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 flex-shrink-0">
          <p className="text-xs text-slate-400 text-center">
            Press Esc to close
          </p>
        </div>
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
