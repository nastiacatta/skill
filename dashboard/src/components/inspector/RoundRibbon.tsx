/**
 * Transformation ribbon: shows how each agent's values flow through the pipeline.
 * Adapted from the RoundInspector design to work with existing pipeline traces.
 *
 * Click a row to highlight that agent. Click a column header for the formula.
 */
import { useState, useMemo } from 'react';
import type { RoundTrace } from '@/lib/coreMechanism/runRoundComposable';
import { SEM } from '@/lib/tokens';

interface Column {
  key: string;
  label: string;
  sym: string;
  formula: string;
  desc: string;
  color: string;
  bg: string;
  getValue: (trace: RoundTrace, i: number) => number;
  format: (v: number) => string;
}

const COLUMNS: Column[] = [
  {
    key: 'sigma', label: 'Skill', sym: 'σᵢ',
    formula: 'σ_{i,t} = σ_min + (1−σ_min) e^{−γ L_{i,t−1}}',
    desc: 'Online skill estimate. Past cumulative loss decays skill toward σ_min.',
    color: SEM.skill.main, bg: SEM.skill.light,
    getValue: (t, i) => t.sigma_t[i],
    format: (v) => v.toFixed(3),
  },
  {
    key: 'deposit', label: 'Deposit', sym: 'bᵢ',
    formula: 'b_{i,t} = f · W_{i,t} · c_{i,t}',
    desc: 'Cash put at risk, scaled by wealth and confidence.',
    color: SEM.deposit.main, bg: SEM.deposit.light,
    getValue: (t, i) => t.deposits[i],
    format: (v) => v.toFixed(2),
  },
  {
    key: 'wager', label: 'Eff. wager', sym: 'mᵢ',
    formula: 'm_{i,t} = b_{i,t}(λ + (1−λ)σ_{i,t})',
    desc: 'Deposit rescaled by the past-only skill gate g(σ). Low skill reduces the effective wager below the deposit.',
    color: SEM.wager.main, bg: SEM.wager.light,
    getValue: (t, i) => t.effectiveWager[i],
    format: (v) => v.toFixed(2),
  },
  {
    key: 'weight', label: 'Weight', sym: 'w̃ᵢ',
    formula: 'w̃_{i,t} = m_{i,t} / Σⱼ mⱼ,t',
    desc: 'Normalised wager share. Determines each report’s weight in the aggregate forecast.',
    color: SEM.aggregate.main, bg: SEM.aggregate.light,
    getValue: (t, i) => t.weights[i],
    format: (v) => (v * 100).toFixed(1) + '%',
  },
  {
    key: 'report', label: 'Report', sym: 'rᵢ',
    formula: 'r_{i,t} ∈ [0, 1]',
    desc: 'Point forecast submitted by agent i.',
    color: SEM.outcome.main, bg: SEM.outcome.light,
    getValue: (t, i) => t.reports[i],
    format: (v) => v.toFixed(3),
  },
  {
    key: 'score', label: 'Score', sym: 'sᵢ',
    formula: 's_{i,t} = 1 − |y_t − r_{i,t}|',
    desc: 'Accuracy score. Higher means the report was closer to the outcome.',
    color: SEM.score.main, bg: SEM.score.light,
    getValue: (t, i) => t.scores[i],
    format: (v) => v.toFixed(3),
  },
  {
    key: 'profit', label: 'Profit', sym: 'πᵢ',
    formula: 'π_{i,t} = Π_{i,t} − b_{i,t}',
    desc: 'Net gain/loss after settlement. Drives wealth update.',
    color: SEM.payoff.main, bg: SEM.payoff.light,
    getValue: (t, i) => t.profit[i],
    format: (v) => (v >= 0 ? '+' : '') + v.toFixed(2),
  },
  {
    key: 'wealth', label: "Wealth W'", sym: "W'ᵢ",
    formula: "W_{i,t+1} = W_{i,t} + π_{i,t}",
    desc: 'Wealth after settlement. Funds future deposits.',
    color: SEM.wealth.main, bg: SEM.wealth.light,
    getValue: (t, i) => t.wealth_after[i],
    format: (v) => v.toFixed(2),
  },
];

function heatOpacity(value: number, min: number, max: number): number {
  if (max === min) return 0.3;
  return 0.1 + 0.5 * ((value - min) / (max - min));
}

function FormulaPanel({ col, onClose }: { col: Column; onClose: () => void }) {
  return (
    <div
      className="absolute z-30 top-full mt-1 left-0 w-64"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border-strong)',
        borderRadius: 6,
        padding: 14,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-3"
        style={{ color: 'var(--ink-faint)', fontSize: 13 }}
      >
        ✕
      </button>
      <p
        className="font-serif mb-2"
        style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}
      >
        {col.label}
      </p>
      <code
        className="block font-mono mb-2"
        style={{
          fontSize: 13,
          background: 'var(--cream)',
          borderRadius: 4,
          padding: '6px 10px',
          color: col.color,
        }}
      >
        {col.formula}
      </code>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
        {col.desc}
      </p>
    </div>
  );
}

interface Props {
  trace: RoundTrace;
  selectedAgent: number | null;
  onSelectAgent: (i: number | null) => void;
}

export default function RoundRibbon({ trace, selectedAgent, onSelectAgent }: Props) {
  const [tooltipCol, setTooltipCol] = useState<string | null>(null);
  const N = trace.participated.length;

  const ranges = useMemo(() => {
    const result: Record<string, { min: number; max: number }> = {};
    for (const col of COLUMNS) {
      const vals = Array.from({ length: N }, (_, i) => col.getValue(trace, i));
      result[col.key] = { min: Math.min(...vals), max: Math.max(...vals) };
    }
    return result;
  }, [trace, N]);

  const toggleAgent = (i: number) => onSelectAgent(selectedAgent === i ? null : i);

  return (
    <div>
      {/* Aggregate summary */}
      <div
        className="flex flex-wrap gap-5 items-baseline px-4 py-3 mb-5"
        style={{
          background: 'var(--cream)',
          border: '1px solid var(--border)',
          borderRadius: 6,
        }}
      >
        {[
          { label: 'Aggregate r̂', value: trace.r_hat.toFixed(4), emphasis: false },
          { label: 'Outcome y',    value: trace.y.toFixed(4),    emphasis: false },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-baseline gap-2">
            <span
              className="uppercase"
              style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}
            >
              {label}
            </span>
            <span
              className="font-mono tabular-nums"
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}
            >
              {value}
            </span>
          </div>
        ))}
        <div className="flex items-baseline gap-2">
          <span
            className="uppercase"
            style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}
          >
            Error
          </span>
          <span
            className="font-mono tabular-nums"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: Math.abs(trace.y - trace.r_hat) < 0.1 ? 'var(--teal-deep)' : 'var(--crimson)',
            }}
          >
            {Math.abs(trace.y - trace.r_hat).toFixed(4)}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="uppercase"
            style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}
          >
            N_eff
          </span>
          <span
            className="font-mono tabular-nums"
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-muted)' }}
          >
            {trace.nEff.toFixed(1)}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="uppercase"
            style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}
          >
            Active
          </span>
          <span
            className="font-mono tabular-nums"
            style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-muted)' }}
          >
            {trace.activeCount}/{N}
          </span>
        </div>
      </div>

      {/* Transformation ribbon */}
      <div className="overflow-x-auto pb-2 -mx-1">
        <table className="border-collapse" style={{ minWidth: `${COLUMNS.length * 100 + 80}px` }}>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 text-left uppercase"
                style={{
                  background: 'var(--card)',
                  padding: '10px 10px 10px 8px',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--ink-soft)',
                  minWidth: 72,
                }}
              >
                Agent
              </th>
              {COLUMNS.map(col => (
                <th
                  key={col.key}
                  className="relative text-center uppercase cursor-pointer hover:opacity-85"
                  style={{
                    padding: '10px 8px',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    background: col.bg,
                    color: col.color,
                    minWidth: 92,
                  }}
                  onClick={() => setTooltipCol(tooltipCol === col.key ? null : col.key)}
                >
                  <span>{col.label}</span>
                  <span
                    className="ml-1"
                    style={{ fontSize: 13, color: 'var(--ink-faint)' }}
                  >
                    ⓘ
                  </span>
                  {tooltipCol === col.key && (
                    <FormulaPanel col={col} onClose={() => setTooltipCol(null)} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: N }, (_, i) => {
              const highlighted = selectedAgent === null || selectedAgent === i;
              const selected = selectedAgent === i;
              const active = trace.participated[i];
              return (
                <tr
                  key={i}
                  onClick={() => toggleAgent(i)}
                  className="cursor-pointer transition-opacity duration-150"
                  style={{
                    opacity: highlighted ? 1 : 0.2,
                    background: selected
                      ? 'var(--navy-tint)'
                      : i % 2 === 0
                      ? 'transparent'
                      : 'rgba(245, 241, 232, 0.5)',
                    boxShadow: selected ? 'inset 0 0 0 1px var(--navy)' : undefined,
                  }}
                >
                  <td
                    className="sticky left-0 z-10 whitespace-nowrap"
                    style={{ padding: '10px 10px 10px 8px', background: 'inherit' }}
                  >
                    <span
                      className="font-serif"
                      style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}
                    >
                      F{i + 1}
                    </span>
                    {!active && (
                      <span
                        className="ml-1.5"
                        style={{
                          fontSize: 13,
                          color: 'var(--ink-faint)',
                          border: '1px solid var(--border)',
                          borderRadius: 3,
                          padding: '1px 5px',
                        }}
                      >
                        out
                      </span>
                    )}
                  </td>
                  {COLUMNS.map(col => {
                    const raw = col.getValue(trace, i);
                    const { min, max } = ranges[col.key];
                    const alpha = heatOpacity(raw, min, max);
                    const isProfit = col.key === 'profit';
                    const profitColor = isProfit
                      ? raw >= 0 ? 'var(--teal-deep)' : 'var(--crimson)'
                      : 'var(--ink)';
                    return (
                      <td
                        key={col.key}
                        className="text-center tabular-nums font-mono"
                        style={{
                          padding: '10px 8px',
                          fontSize: 13,
                          color: profitColor,
                          background: selected
                            ? `${col.color}${Math.round(alpha * 55).toString(16).padStart(2, '0')}`
                            : active
                            ? `${col.color}${Math.round(alpha * 18).toString(16).padStart(2, '0')}`
                            : undefined,
                        }}
                      >
                        {col.format(raw)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p
        className="mt-3"
        style={{ fontSize: 14, color: 'var(--ink-soft)' }}
      >
        Click any row to highlight its path. Click a column header for the formula.
      </p>
    </div>
  );
}
