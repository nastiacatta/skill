/**
 * ModelAuditPanel — Per-model CRPS breakdown, regime analysis,
 * XGBoost deep dive, and model annotations for the audit page.
 */

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { useAuditData } from '@/hooks/useAuditData';
import {
  computeForecasterStats,
  regimeBreakdown,
  rollingDifference,
  rowValue,
} from '@/lib/audit/auditUtils';
import {
  MODEL_ANNOTATIONS,
  XGBOOST_SUGGESTIONS,
} from '@/lib/audit/auditContent';
import { FORECASTER_COLOURS, PALETTE, ORANGE } from '@/lib/palette';
import { Card, SectionHeading } from '@/components/platform/ui';

function getColour(name: string): string {
  return FORECASTER_COLOURS[name] ?? PALETTE.slate;
}

// ════════════════════════════════════════════════════════════════════════════

export default function ModelAuditPanel() {
  const { comparison } = useAuditData();
  const [selectedForecaster, setSelectedForecaster] = useState<string>('all');

  const forecasters = useMemo(
    () => comparison?.config?.forecasters ?? comparison?.forecaster_names ?? [],
    [comparison],
  );

  const perAgentCrps = useMemo(() => comparison?.per_agent_crps ?? [], [comparison]);
  const perRound = useMemo(() => comparison?.per_round ?? [], [comparison]);
  const nRounds = perRound.length;

  // ── Derived metrics ────────────────────────────────────────────────
  const forecasterStats = useMemo(
    () => computeForecasterStats(perAgentCrps, forecasters),
    [perAgentCrps, forecasters],
  );

  const regimeData = useMemo(
    () => regimeBreakdown(perRound, perAgentCrps, forecasters),
    [perRound, perAgentCrps, forecasters],
  );

  // XGBoost deep-dive data
  // Forecaster names in comparison.json are the full display names
  // (e.g. 'Naive (last value)', 'EWMA (5)', 'Ensemble (Naive+EWMA)'),
  // not their short labels. Match by prefix to stay resilient to future
  // name changes.
  const findForecaster = (prefix: string): string | null =>
    forecasters.find((name) => name.startsWith(prefix)) ?? null;

  const xgbName = findForecaster('XGBoost');
  const naiveName = findForecaster('Naive');

  const xgbComparison = useMemo(() => {
    if (!forecasterStats.length) return [];
    const targetPrefixes = ['XGBoost', 'Naive', 'EWMA', 'Ensemble'];
    return targetPrefixes
      .map((prefix) => {
        const stat = forecasterStats.find((s) => s.forecaster.startsWith(prefix));
        return stat ? { name: stat.forecaster, meanCrps: stat.meanCrps } : null;
      })
      .filter(Boolean) as Array<{ name: string; meanCrps: number }>;
  }, [forecasterStats]);

  const rollingXgbNaive = useMemo(() => {
    if (!xgbName || !naiveName || perAgentCrps.length === 0) return [];
    const xgbSeries = perAgentCrps.map((row) =>
      rowValue(row, xgbName, forecasters, 'crps') ?? 0,
    );
    const naiveSeries = perAgentCrps.map((row) =>
      rowValue(row, naiveName, forecasters, 'crps') ?? 0,
    );
    return rollingDifference(xgbSeries, naiveSeries, 168);
  }, [perAgentCrps, forecasters, xgbName, naiveName]);

  // Per-round chart data
  const perRoundChartData = useMemo(() => {
    if (selectedForecaster === 'all') {
      return perAgentCrps.map((row, i) => ({ t: i, ...row }));
    }
    return perAgentCrps.map((row, i) => ({
      t: i,
      // Use rowValue so the series works with both name-keyed (new)
      // and indexed-keyed (legacy) per_agent_crps rows.
      [selectedForecaster]: rowValue(row, selectedForecaster, forecasters, 'crps'),
    }));
  }, [perAgentCrps, selectedForecaster, forecasters]);

  if (!comparison) {
    return (
      <Card padding="roomy" className="text-center" style={{ borderStyle: 'dashed' }}>
        <p className="text-sm text-slate-400">
          Model audit data unavailable.
        </p>
      </Card>
    );
  }

  const visibleForecasters =
    selectedForecaster === 'all' ? forecasters : [selectedForecaster];

  return (
    <div className="space-y-10">
      {/* ── Sample-size warning ──────────────────────────────────── */}
      {nRounds < 100 && (
        <Card padding="compact" className="border-amber-200" style={{ background: 'var(--amber-tint)' }}>
          <p className="text-sm font-medium text-amber-800">
            ⚠ Sample size warning: Only {nRounds} evaluation rounds available.
            Results may be unreliable with fewer than 100 rounds.
          </p>
        </Card>
      )}

      {/* ── Forecaster ranking table ─────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading level={3} title="Forecaster ranking" />
        <p className="text-sm text-slate-500">
          Per-round CRPS by forecaster, where lower is better.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="text-left py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  Forecaster
                </th>
                <th className="text-right py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  Mean CRPS
                </th>
                <th className="text-right py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  Median CRPS
                </th>
                <th className="text-right py-2 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  Std CRPS
                </th>
              </tr>
            </thead>
            <tbody>
              {[...forecasterStats]
                .sort((a, b) => a.meanCrps - b.meanCrps)
                .map((row, i) => (
                  <tr
                    key={row.forecaster}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="py-2 pr-4 text-slate-400 text-[13px]">
                      {i + 1}
                    </td>
                    <td className="py-2 pr-4 text-slate-800 font-medium">
                      <span
                        className="inline-block w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: getColour(row.forecaster) }}
                      />
                      {row.forecaster}
                    </td>
                    <td className="py-2 pr-4 text-right text-slate-700 tabular-nums">
                      {row.meanCrps.toFixed(4)}
                    </td>
                    <td className="py-2 pr-4 text-right text-slate-700 tabular-nums">
                      {row.medianCrps.toFixed(4)}
                    </td>
                    <td className="py-2 text-right text-slate-700 tabular-nums">
                      {row.stdCrps.toFixed(4)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Per-round CRPS time-series ───────────────────────────── */}
      <section className="space-y-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 32 }}>
        <div className="flex items-center justify-between">
          <SectionHeading level={3} title="Per-round CRPS" />
          <select
            value={selectedForecaster}
            onChange={(e) => setSelectedForecaster(e.target.value)}
            className="text-sm border border-slate-200 rounded px-2 py-1 text-slate-600 bg-white"
          >
            <option value="all">All forecasters</option>
            {forecasters.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        {perRoundChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={perRoundChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="t"
                tick={{ fontSize: 14, fill: '#94a3b8' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 14, fill: '#94a3b8' }}
                tickLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 14,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
              />
              {visibleForecasters.map((f) => (
                <Line
                  key={f}
                  type="monotone"
                  dataKey={f}
                  stroke={getColour(f)}
                  dot={false}
                  strokeWidth={1.5}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 py-8 text-center">
            Per-agent CRPS data not available.
          </p>
        )}
      </section>

      {/* ── Regime breakdown table ───────────────────────────────── */}
      <section className="space-y-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 32 }}>
        <SectionHeading level={3} title="Regime breakdown" />
        <p className="text-sm text-slate-500">
          CRPS in high-wind (top quartile) versus low-wind (bottom quartile) conditions.
        </p>
        {regimeData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                    Forecaster
                  </th>
                  <th className="text-right py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                    Overall
                  </th>
                  <th className="text-right py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                    High wind
                  </th>
                  <th className="text-right py-2 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                    Low wind
                  </th>
                </tr>
              </thead>
              <tbody>
                {regimeData
                  .sort((a, b) => a.meanCrps - b.meanCrps)
                  .map((row) => (
                    <tr
                      key={row.forecaster}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-2 pr-4 text-slate-800 font-medium">
                        {row.forecaster}
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-700 tabular-nums">
                        {row.meanCrps.toFixed(4)}
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-700 tabular-nums">
                        {Number.isFinite(row.highWindCrps)
                          ? row.highWindCrps.toFixed(4)
                          : '—'}
                      </td>
                      <td className="py-2 text-right text-slate-700 tabular-nums">
                        {Number.isFinite(row.lowWindCrps)
                          ? row.lowWindCrps.toFixed(4)
                          : '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">
            Insufficient data for regime breakdown (need ≥ 4 rounds).
          </p>
        )}
      </section>

      {/* ── Model annotations ────────────────────────────────────── */}
      <section className="space-y-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 32 }}>
        <SectionHeading level={3} title="Model annotations" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODEL_ANNOTATIONS.map((ann) => (
            <Card key={ann.forecaster} padding="default" className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: getColour(ann.forecaster) }}
                />
                <h3 className="text-base font-semibold text-slate-900">
                  {ann.forecaster}
                </h3>
              </div>
              <p className="text-sm text-slate-700">
                <span className="font-medium text-slate-800">Strengths: </span>
                {ann.strengths}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-700">
                  Weaknesses:{' '}
                </span>
                {ann.weaknesses}
              </p>
              <p className="text-sm text-slate-500">
                <span className="font-medium text-slate-600">Theory: </span>
                {ann.theoryNote}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* ── XGBoost Deep Dive ────────────────────────────────────── */}
      <section className="space-y-6" style={{ borderTop: '1px solid var(--border)', paddingTop: 32 }}>
        <SectionHeading level={3} title="XGBoost deep dive" />
        <p className="text-sm text-slate-500">
          XGBoost ranks first by mean CRPS, but its lead over persistence baselines is narrow.
        </p>

        {/* Comparison bar chart */}
        {xgbComparison.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-700">
              XGBoost versus key baselines
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={xgbComparison} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 14, fill: '#94a3b8' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 14, fill: '#475569' }}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 14,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                  formatter={(value: unknown) => Number(value).toFixed(4)}
                />
                <Bar
                  dataKey="meanCrps"
                  fill={ORANGE}
                  radius={[0, 4, 4, 0]}
                  name="Mean CRPS"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Rolling CRPS difference chart */}
        {rollingXgbNaive.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-700">
              Rolling CRPS difference (XGBoost &minus; Naive, 168-hour window)
            </h3>
            <p className="text-sm text-slate-500">
              Positive values mark windows where XGBoost trails the naive baseline.
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={rollingXgbNaive}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="t"
                  tick={{ fontSize: 14, fill: '#94a3b8' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 14, fill: '#94a3b8' }}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 14,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                  formatter={(value: unknown) => Number(value).toFixed(4)}
                />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="diff"
                  stroke={ORANGE}
                  dot={false}
                  strokeWidth={1.5}
                  name="XGB − Naive"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Textual explanation */}
        <Card padding="default" className="space-y-2" style={{ background: 'var(--cream)' }}>
          <h3 className="text-base font-semibold text-slate-800">
            Why the lead over persistence is narrow
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            At the 1h-ahead horizon hourly wind power is autocorrelated above 0.95, so the last-value forecast is hard to beat and XGBoost wins only marginally.
          </p>
        </Card>

        {/* Improvement suggestions */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-slate-700">
            Improvement suggestions
          </h3>
          {XGBOOST_SUGGESTIONS.map((sug) => (
            <Card key={sug.id} padding="default" className="space-y-1">
              <h4 className="text-base font-medium text-slate-800">
                {sug.title}
              </h4>
              <p className="text-sm text-slate-600">{sug.description}</p>
              {sug.reference && (
                <p className="text-[13px] text-slate-400">
                  Ref: {sug.reference}
                </p>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
