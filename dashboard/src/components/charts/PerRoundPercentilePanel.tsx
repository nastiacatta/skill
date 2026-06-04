import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SmartTooltip } from '@/components/dashboard/SmartTooltip';
import {
  AXIS_STROKE,
  AXIS_TICK,
  GRID_PROPS,
} from '@/components/lab/shared';
import { PALETTE } from '@/lib/palette';

interface PerRoundRow {
  t: number;
  crps_uniform: number;
  crps_skill: number;
  crps_mechanism: number;
  crps_best_single: number;
  crps_inverse_variance: number;
  crps_trimmed_mean: number;
  crps_median: number;
  crps_oracle: number;
}

interface ComparisonShape {
  per_round: PerRoundRow[];
}

const METHOD_KEYS: { key: keyof PerRoundRow; label: string; colour: string }[] = [
  { key: 'crps_uniform', label: 'Uniform', colour: PALETTE.slate },
  { key: 'crps_skill', label: 'Skill-only', colour: PALETTE.purple },
  { key: 'crps_mechanism', label: 'Skill × stake', colour: PALETTE.teal },
  { key: 'crps_inverse_variance', label: 'Inverse-variance', colour: '#0EA5E9' },
  { key: 'crps_trimmed_mean', label: 'Trimmed mean', colour: '#7C3AED' },
  { key: 'crps_median', label: 'Median', colour: '#0891B2' },
  { key: 'crps_best_single', label: 'Best single', colour: '#B45309' },
  { key: 'crps_oracle', label: 'Oracle', colour: '#000000' },
];

/**
 * Computes the q-th percentile (q in [0,1]) using linear interpolation.
 */
function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const i = q * (sorted.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  const frac = i - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Tail-CRPS panel: P95 of the per-round CRPS distribution by method.
 *
 * The body headline is the mean CRPS gain (−7.1% on Elia wind). This panel
 * surfaces the same comparison conditioned on the worst 5% of rounds, which
 * is where post-processed forecasts under-perform most. Sourced live from the
 * `per_round` array in the wind comparison.json.
 */
export default function PerRoundPercentilePanel() {
  const [comparison, setComparison] = useState<ComparisonShape | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/real_data/elia_wind/data/comparison.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ComparisonShape) => {
        if (!cancelled) setComparison(d);
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    if (!comparison) return null;
    const rows = comparison.per_round;
    const out = METHOD_KEYS.map(({ key, label, colour }) => {
      const sorted = [...rows]
        .map((r) => r[key] as number)
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b);
      const mean = sorted.length
        ? sorted.reduce((s, v) => s + v, 0) / sorted.length
        : NaN;
      return {
        method: label,
        colour,
        p95: percentile(sorted, 0.95),
        p99: percentile(sorted, 0.99),
        mean,
      };
    });
    return { rows: out, n: rows.length };
  }, [comparison]);

  if (err) {
    return (
      <div
        className="p-5 rounded-xl"
        role="alert"
        style={{ background: '#FBECEF', border: '1px solid #E85D4A' }}
      >
        <p style={{ fontSize: 13, color: '#991B1B', fontWeight: 500 }}>
          Per-round percentile data could not be loaded.
        </p>
        <p style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>
          {err}
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-white p-5"
        role="status"
        aria-label="Loading per-round percentile data"
      >
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 animate-pulse" style={{ height: 280 }} />
      </div>
    );
  }

  const uniform = stats.rows.find((r) => r.method === 'Uniform');
  const mechanism = stats.rows.find((r) => r.method === 'Skill × stake');
  const tailGain =
    uniform && mechanism && uniform.p95 > 0
      ? ((mechanism.p95 - uniform.p95) / uniform.p95) * 100
      : NaN;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">
          Tail-CRPS (95th-percentile per-round CRPS) by aggregation rule
        </h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          The headline is a mean over {stats.n.toLocaleString()} evaluation rounds. This panel
          conditions on the worst 5% of rounds and asks how each rule does there. The skill × stake
          mechanism trims the tail by{' '}
          {Number.isFinite(tailGain) ? `${tailGain >= 0 ? '+' : ''}${tailGain.toFixed(1)}%` : '—'}{' '}
          relative to uniform.
        </p>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={stats.rows} margin={{ top: 12, right: 24, bottom: 36, left: 36 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="method"
            tick={{ ...AXIS_TICK, fontSize: 11 }}
            stroke={AXIS_STROKE}
            angle={-20}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            label={{
              value: 'CRPS (95th percentile)',
              angle: -90,
              position: 'insideLeft',
              offset: 8,
              fontSize: 11,
              fill: '#64748b',
            }}
          />
          <Tooltip content={<SmartTooltip />} />
          <Bar dataKey="p95" name="P95 CRPS" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {stats.rows.map((d) => (
              <Cell key={d.method} fill={d.colour} opacity={0.85} />
            ))}
            <LabelList
              dataKey="p95"
              position="top"
              style={{ fill: '#1F2A38', fontSize: 11, fontWeight: 500 }}
              formatter={(v) => (typeof v === 'number' ? v.toFixed(3) : '')}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="text-left py-2 pr-3 font-medium">Rule</th>
              <th className="text-right py-2 px-2 font-medium">Mean CRPS</th>
              <th className="text-right py-2 px-2 font-medium">P95 CRPS</th>
              <th className="text-right py-2 px-2 font-medium">P99 CRPS</th>
              <th className="text-right py-2 px-2 font-medium">P95 Δ vs uniform</th>
            </tr>
          </thead>
          <tbody>
            {stats.rows.map((r) => {
              const delta =
                uniform && uniform.p95 > 0 ? ((r.p95 - uniform.p95) / uniform.p95) * 100 : NaN;
              return (
                <tr key={r.method} className="border-b border-slate-50 font-mono tabular-nums">
                  <td className="text-left py-1.5 pr-3" style={{ color: r.colour, fontWeight: 600 }}>
                    {r.method}
                  </td>
                  <td className="text-right py-1.5 px-2">{r.mean.toFixed(5)}</td>
                  <td className="text-right py-1.5 px-2">{r.p95.toFixed(5)}</td>
                  <td className="text-right py-1.5 px-2">{r.p99.toFixed(5)}</td>
                  <td className="text-right py-1.5 px-2">
                    {r.method === 'Uniform' || !Number.isFinite(delta)
                      ? '—'
                      : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
