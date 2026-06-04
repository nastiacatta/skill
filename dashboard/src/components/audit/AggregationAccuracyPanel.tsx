/**
 * AggregationAccuracyPanel — Method comparison, oracle gap, Vitali OGD gap,
 * calibration reliability diagram, per-quantile CRPS, alternative approaches,
 * and Ranjan-Gneiting explanation for the audit page.
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { useAuditData } from '@/hooks/useAuditData';
import { PALETTE } from '@/lib/palette';
import { Card, SectionHeading, StatTile, Tag } from '@/components/platform/ui';

// ── Static content ─────────────────────────────────────────────────────────

const ALTERNATIVE_APPROACHES = [
  {
    id: 'vitali-ogd',
    title: 'Per-quantile Online Gradient Descent (OGD), Vitali et al.',
    description:
      'Learns a separate weight vector per quantile level, adapting to forecasters strong in different parts of the distribution.',
  },
  {
    id: 'kernel-pool',
    title: 'Kernel-embedded probabilistic forecast pooling (Bassetti et al.)',
    description:
      'Pools in a reproducing kernel Hilbert space, preserving calibration the linear pool destroys.',
  },
  {
    id: 'quasi-arith',
    title: 'Quasi-arithmetic pooling with a proper scoring rule',
    description:
      'Replaces the arithmetic mean with a generalised mean that can preserve calibration.',
  },
  {
    id: 'recalibration',
    title: 'Empirical recalibration transform',
    description:
      'Corrects tail miscalibration by post-processing the pooled CDF, for example isotonic regression on the PIT.',
  },
];

// ── Method display names ───────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  uniform: 'Uniform',
  skill: 'Skill-weighted',
  mechanism: 'Mechanism',
  best_single: 'Best Single',
  inverse_variance: 'Inverse Variance',
  trimmed_mean: 'Trimmed Mean',
  median: 'Median',
  oracle: 'Oracle',
};

// ════════════════════════════════════════════════════════════════════════════

export default function AggregationAccuracyPanel() {
  const { comparison, baselines } = useAuditData();

  const comparisonRows = useMemo(() => comparison?.rows ?? [], [comparison]);
  const calibration = useMemo(() => comparison?.calibration ?? [], [comparison]);
  const baselineSummary = useMemo(() => baselines?.summary ?? [], [baselines]);

  // ── Method comparison table (8 methods) ────────────────────────
  const methodTable = useMemo(() => {
    // Combine comparison rows and baselines summary
    const methods = new Map<string, { mean_crps: number; delta: number }>();

    // From comparison.json rows
    for (const row of comparisonRows) {
      methods.set(row.method, {
        mean_crps: row.mean_crps,
        delta: row.delta_crps_vs_equal,
      });
    }

    // From baselines.json summary (may add inverse_variance, trimmed_mean, median, oracle)
    for (const row of baselineSummary) {
      if (!methods.has(row.method)) {
        methods.set(row.method, {
          mean_crps: row.mean_crps,
          delta: row.delta_vs_uniform,
        });
      }
    }

    const targetOrder = [
      'uniform',
      'skill',
      'mechanism',
      'best_single',
      'inverse_variance',
      'trimmed_mean',
      'median',
      'oracle',
    ];

    return targetOrder
      .filter((m) => methods.has(m))
      .map((m) => ({
        method: m,
        label: METHOD_LABELS[m] ?? m,
        ...methods.get(m)!,
      }));
  }, [comparisonRows, baselineSummary]);

  // ── Oracle gap ─────────────────────────────────────────────────
  const oracleGap = useMemo(() => {
    const mechanism = methodTable.find((m) => m.method === 'mechanism');
    const oracle = methodTable.find((m) => m.method === 'oracle');
    if (!mechanism || !oracle || oracle.mean_crps === 0) return null;
    const gap =
      ((mechanism.mean_crps - oracle.mean_crps) / oracle.mean_crps) * 100;
    return { gap, mechanismCrps: mechanism.mean_crps, oracleCrps: oracle.mean_crps };
  }, [methodTable]);

  // ── Vitali OGD gap ─────────────────────────────────────────────
  const vitaliGap = useMemo(() => {
    const vitali = baselineSummary.find(
      (r) => r.method === 'vitali_ogd' || r.method === 'vitali',
    );
    const mechanism = baselineSummary.find((r) => r.method === 'mechanism');
    if (!vitali || !mechanism) return null;
    return {
      vitaliPct: vitali.pct_vs_uniform,
      mechanismPct: mechanism.pct_vs_uniform,
      gap: vitali.pct_vs_uniform - mechanism.pct_vs_uniform,
    };
  }, [baselineSummary]);

  // ── Calibration reliability diagram data ───────────────────────
  const calibrationData = useMemo(() => {
    return calibration.map((c) => ({
      nominal: c.nominal ?? c.tau,
      empirical: c.empirical,
      gap: c.gap,
    }));
  }, [calibration]);

  // ── Per-quantile CRPS data (from calibration gaps) ─────────────
  const perQuantileData = useMemo(() => {
    return calibration.map((c) => ({
      tau: (c.tau ?? c.nominal)?.toFixed(2),
      gap: Math.abs(c.gap),
    }));
  }, [calibration]);

  if (!comparison) {
    return (
      <Card padding="roomy" className="text-center" style={{ borderStyle: 'dashed' }}>
        <p className="text-sm text-slate-400">
          Aggregation accuracy data unavailable.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Method comparison table ──────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading level={3} title="Method comparison" />
        <p className="text-sm text-slate-500">
          Mean CRPS per method against uniform weighting, where a negative delta is an improvement.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="text-right py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  Mean CRPS
                </th>
                <th className="text-right py-2 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  Δ vs Uniform
                </th>
              </tr>
            </thead>
            <tbody>
              {methodTable.map((row) => (
                <tr
                  key={row.method}
                  className={`border-b border-slate-100 last:border-0 ${
                    row.method === 'mechanism'
                      ? 'bg-indigo-50'
                      : row.method === 'oracle'
                        ? 'bg-emerald-50'
                        : ''
                  }`}
                >
                  <td className="py-2 pr-4 text-slate-800 font-medium">
                    {row.label}
                  </td>
                  <td className="py-2 pr-4 text-right text-slate-700 tabular-nums">
                    {row.mean_crps.toFixed(4)}
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${
                      row.delta < 0 ? 'text-emerald-600' : 'text-slate-600'
                    }`}
                  >
                    {row.delta > 0 ? '+' : ''}
                    {row.delta.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Oracle gap badge ──────────────────────────────────────── */}
      {oracleGap && (
        <section className="space-y-4">
          <SectionHeading level={3} title="Oracle gap" />
          <div className="flex items-center gap-4">
            <Tag
              tone={
                oracleGap.gap < 10 ? 'good' : oracleGap.gap < 25 ? 'caution' : 'bad'
              }
            >
              {oracleGap.gap.toFixed(1)}%
            </Tag>
            <span className="text-sm text-slate-500">
              Mechanism ({oracleGap.mechanismCrps.toFixed(4)}) vs Oracle (
              {oracleGap.oracleCrps.toFixed(4)})
            </span>
          </div>
        </section>
      )}

      {/* ── Vitali OGD gap comparison ────────────────────────────── */}
      {vitaliGap && (
        <section className="space-y-4">
          <SectionHeading level={3} title="Vitali OGD comparison" />
          <div className="grid grid-cols-2 gap-4">
            <StatTile
              size="lg"
              label="Mechanism vs uniform"
              value={vitaliGap.mechanismPct.toFixed(1)}
              unit="%"
              accent="aggregate"
            />
            <StatTile
              size="lg"
              label="Vitali OGD vs uniform"
              value={vitaliGap.vitaliPct.toFixed(1)}
              unit="%"
              accent="skill"
            />
          </div>
          <p className="text-sm text-slate-500">
            The {Math.abs(vitaliGap.gap).toFixed(1)}-percentage-point gap is the cost of one weight vector across all quantiles rather than per-quantile adaptation.
          </p>
        </section>
      )}

      {/* ── Calibration reliability diagram ──────────────────────── */}
      <section className="space-y-4">
        <SectionHeading level={3} title="Calibration reliability diagram" />
        <p className="text-sm text-slate-500">
          PIT coverage by nominal quantile, where perfect calibration tracks the diagonal.
        </p>
        {calibrationData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={calibrationData}>
              <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
              <XAxis
                dataKey="nominal"
                tick={{ fontSize: 14, fill: PALETTE.slate }}
                tickLine={false}
                label={{
                  value: 'Nominal',
                  position: 'insideBottom',
                  offset: -5,
                  style: { fontSize: 14, fill: PALETTE.slate },
                }}
              />
              <YAxis
                tick={{ fontSize: 14, fill: PALETTE.slate }}
                tickLine={false}
                width={50}
                label={{
                  value: 'Empirical',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 14, fill: PALETTE.slate },
                }}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 14,
                  borderRadius: 8,
                  border: `1px solid ${PALETTE.border}`,
                }}
              />
              {/* Perfect calibration diagonal */}
              <ReferenceLine
                segment={[
                  { x: 0, y: 0 },
                  { x: 1, y: 1 },
                ]}
                stroke={PALETTE.slate}
                strokeDasharray="3 3"
              />
              <Line
                type="monotone"
                dataKey="empirical"
                stroke={PALETTE.teal}
                dot={{ r: 3, fill: PALETTE.teal }}
                strokeWidth={2}
                name="Empirical coverage"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 py-8 text-center">
            Calibration data not available.
          </p>
        )}
      </section>

      {/* ── Per-quantile CRPS chart ──────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading level={3} title="Per-quantile calibration gap" />
        <p className="text-sm text-slate-500">
          Absolute calibration gap |empirical − nominal| by quantile level τ.
        </p>
        {perQuantileData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={perQuantileData}>
              <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} />
              <XAxis
                dataKey="tau"
                tick={{ fontSize: 14, fill: PALETTE.slate }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 14, fill: PALETTE.slate }}
                tickLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 14,
                  borderRadius: 8,
                  border: `1px solid ${PALETTE.border}`,
                }}
                formatter={(value: unknown) => Number(value).toFixed(4)}
              />
              <Bar
                dataKey="gap"
                fill={PALETTE.teal}
                radius={[4, 4, 0, 0]}
                name="|Gap|"
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">
            Per-quantile data not available.
          </p>
        )}
      </section>

      {/* ── Alternative approaches ───────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading level={3} title="Alternative approaches" />
        <div className="space-y-3">
          {ALTERNATIVE_APPROACHES.map((approach) => (
            <Card key={approach.id} padding="default" className="space-y-1">
              <h3 className="text-base font-medium text-slate-800">
                {approach.title}
              </h3>
              <p className="text-sm text-slate-600">{approach.description}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Ranjan-Gneiting explanation ──────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading level={3} title="Why the aggregate is miscalibrated" />
        <Card padding="default" className="space-y-2 border-amber-200" style={{ background: 'var(--amber-tint)' }}>
          <p className="text-sm text-slate-700 leading-relaxed">
            <span className="font-semibold">Ranjan &amp; Gneiting (2010)</span>{' '}
            proved that any nontrivial weighted average of calibrated forecasts is itself uncalibrated.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            The quantile-average pool used here inherits a directional coverage bias: central quantiles (0.25&ndash;0.75) track the diagonal while the outer quantiles (0.1 and 0.9) show gaps of 3&ndash;5 percentage points. Post-hoc recalibration closes them after settlement.
          </p>
        </Card>
      </section>
    </div>
  );
}
