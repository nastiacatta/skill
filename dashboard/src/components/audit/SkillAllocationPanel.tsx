/**
 * SkillAllocationPanel — Sigma bar chart, sigma trajectories,
 * rank correlation, convergence analysis, parameter comparison,
 * and indistinguishable skill warning for the audit page.
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
} from 'recharts';
import { useAuditData } from '@/hooks/useAuditData';
import {
  convergenceRound,
  spearmanRank,
  findIndistinguishable,
} from '@/lib/audit/auditUtils';
import { FORECASTER_COLOURS, PALETTE } from '@/lib/palette';
import { Card, SectionHeading, Tag } from '@/components/platform/ui';

function getColour(name: string): string {
  return FORECASTER_COLOURS[name] ?? PALETTE.slate;
}

// ════════════════════════════════════════════════════════════════════════════

export default function SkillAllocationPanel() {
  const { comparison } = useAuditData();

  const forecasters = useMemo(
    () => comparison?.config?.forecasters ?? comparison?.forecaster_names ?? [],
    [comparison],
  );

  const steadyState = useMemo(() => comparison?.steady_state ?? [], [comparison]);
  const skillHistory = useMemo(() => comparison?.skill_history ?? [], [comparison]);

  // ── Sigma bar chart data (sorted highest to lowest) ────────────
  const sigmaBarData = useMemo(() => {
    return [...steadyState]
      .sort((a, b) => b.mean_sigma - a.mean_sigma)
      .map((s) => ({
        name: s.forecaster,
        sigma: s.mean_sigma,
        fill: getColour(s.forecaster),
      }));
  }, [steadyState]);

  // ── Sigma trajectory chart data ────────────────────────────────
  const trajectoryData = useMemo(() => {
    return skillHistory.map((row, i) => ({ t: i, ...row }));
  }, [skillHistory]);

  // ── Rank correlation (Spearman ρ) ──────────────────────────────
  const rankCorrelation = useMemo(() => {
    if (steadyState.length < 2) return NaN;
    // Compare mean_sigma ordering vs mean_score ordering
    const sigmas = steadyState.map((s) => s.mean_sigma);
    const scores = steadyState.map((s) => s.mean_score ?? 0);
    return spearmanRank(sigmas, scores);
  }, [steadyState]);

  // ── Convergence analysis ───────────────────────────────────────
  const convergence = useMemo(
    () => convergenceRound(skillHistory, forecasters, 50),
    [skillHistory, forecasters],
  );

  // ── Indistinguishable skill pairs ──────────────────────────────
  const indistinguishablePairs = useMemo(() => {
    const entries = steadyState.map((s) => ({
      name: s.forecaster,
      sigma: s.mean_sigma,
    }));
    return findIndistinguishable(entries, 0.05);
  }, [steadyState]);

  if (!comparison) {
    return (
      <Card padding="roomy" className="text-center" style={{ borderStyle: 'dashed' }}>
        <p className="text-sm text-slate-400">
          Skill allocation data unavailable.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── Indistinguishable skill warning ──────────────────────── */}
      {indistinguishablePairs.length > 0 && (
        <Card padding="compact" className="border-amber-200" style={{ background: 'var(--amber-tint)' }}>
          <p className="text-sm font-medium text-amber-800">
            ⚠ Indistinguishable skill estimates detected:
          </p>
          <ul className="mt-1 list-disc list-inside text-sm text-amber-700">
            {indistinguishablePairs.map((pair, i) => (
              <li key={i}>
                {pair.forecasterA} ↔ {pair.forecasterB} (|Δσ| ={' '}
                {pair.sigmaDiff.toFixed(4)})
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── High-rho warning: skill averaging window too short for noise ─ */}
      {comparison?.config?.rho !== undefined && comparison.config.rho >= 0.3 && (
        <Card padding="compact" className="border-amber-300" style={{ background: 'var(--amber-tint)' }}>
          <p className="text-sm font-medium text-amber-900">
            ⚠ EWMA learning rate ρ = {comparison.config.rho} may be too
            reactive for reliable skill ranking
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Half-life &asymp; {(Math.LN2 / comparison.config.rho).toFixed(1)} rounds, so the estimate averages only the last few rounds and close rankings flip. A smaller ρ trades adaptation for stability.
          </p>
        </Card>
      )}

      {/* ── Sigma bar chart ──────────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading level={3} title="Steady-state skill estimates (σ)" />
        <p className="text-sm text-slate-500">
          Mean σ from the skill gate, where higher means greater estimated skill.
        </p>
        {sigmaBarData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sigmaBarData} layout="vertical">
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
                width={100}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 14,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                }}
                formatter={(value: unknown) => Number(value).toFixed(4)}
              />
              <Bar dataKey="sigma" radius={[0, 4, 4, 0]} name="Mean σ">
                {sigmaBarData.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">
            Steady-state data not available.
          </p>
        )}
      </section>

      {/* ── Sigma trajectory chart ───────────────────────────────── */}
      <section className="space-y-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 32 }}>
        <SectionHeading level={3} title="Skill trajectories over time" />
        <p className="text-sm text-slate-500">
          σ estimates across evaluation rounds.
        </p>
        {trajectoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trajectoryData}>
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
              {forecasters.map((f) => (
                <Line
                  key={f}
                  type="monotone"
                  dataKey={f}
                  stroke={getColour(f)}
                  dot={false}
                  strokeWidth={1.5}
                  name={f}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 py-8 text-center">
            Skill history not available.
          </p>
        )}
      </section>

      {/* ── Rank correlation badge ───────────────────────────────── */}
      <section className="space-y-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 32 }}>
        <SectionHeading level={3} title="Rank correlation" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Spearman ρ:</span>
            <Tag
              tone={
                Number.isFinite(rankCorrelation) && rankCorrelation >= 0.9
                  ? 'good'
                  : Number.isFinite(rankCorrelation) && rankCorrelation >= 0.7
                    ? 'caution'
                    : 'bad'
              }
            >
              {Number.isFinite(rankCorrelation)
                ? rankCorrelation.toFixed(3)
                : 'N/A'}
            </Tag>
          </div>
          <span className="text-sm text-slate-500">
            {Number.isFinite(rankCorrelation) && rankCorrelation >= 0.9
              ? 'Strong agreement between skill estimates and actual scores'
              : Number.isFinite(rankCorrelation) && rankCorrelation >= 0.7
                ? 'Moderate agreement: skill estimates partially track actual performance'
                : 'Weak agreement: skill estimates may not reflect true quality'}
          </span>
        </div>
      </section>

      {/* ── Convergence analysis ─────────────────────────────────── */}
      <section className="space-y-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 32 }}>
        <SectionHeading level={3} title="Convergence analysis" />
        <Card padding="default" className="space-y-2">
          {convergence.convergedAtRound !== null ? (
            <>
              <p className="text-sm text-slate-700">
                Rank ordering converged at round{' '}
                <span className="font-bold text-slate-900">
                  {convergence.convergedAtRound}
                </span>{' '}
                and remained stable for{' '}
                <span className="font-bold text-slate-900">
                  {convergence.stableForRounds}
                </span>{' '}
                consecutive rounds.
              </p>
              <p className="text-sm text-slate-500">
                Final ordering:{' '}
                {convergence.finalOrdering.join(' > ')}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Rank ordering did not converge for 50 consecutive rounds.
              Longest stable streak:{' '}
              <span className="font-bold">{convergence.stableForRounds}</span>{' '}
              rounds.
            </p>
          )}
        </Card>
      </section>

      {/* ── Parameter comparison ──────────────────────────────────── */}
      <section className="space-y-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 32 }}>
        <SectionHeading level={3} title="Parameter comparison" />
        <p className="text-sm text-slate-500">
          Default versus tuned parameters, where sharper tuning differentiates skill faster but reacts more to noise.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  Parameter
                </th>
                <th className="text-right py-2 pr-4 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  Default
                </th>
                <th className="text-right py-2 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
                  Tuned
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 text-slate-700">
                  γ (skill sharpness)
                </td>
                <td className="py-2 pr-4 text-right text-slate-600 tabular-nums">
                  4
                </td>
                <td className="py-2 text-right text-slate-600 tabular-nums">
                  16
                </td>
              </tr>
              <tr className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-4 text-slate-700">
                  ρ (EWMA learning rate)
                </td>
                <td className="py-2 pr-4 text-right text-slate-600 tabular-nums">
                  0.1
                </td>
                <td className="py-2 text-right text-slate-600 tabular-nums">
                  0.5
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Card padding="default" style={{ background: 'var(--cream)' }}>
          <p className="text-sm text-slate-600 leading-relaxed">
            The tuned values (γ = 16, ρ = 0.5) sharpen the loss-to-skill map σ = σ_min + (1−σ_min)·exp(−γL) and speed adaptation, at the cost of occasional rank flips during regime transitions.
          </p>
        </Card>
      </section>

      {/* ── Hyperparameter provenance ───────────────────────────────── */}
      <section className="space-y-4" style={{ borderTop: '1px solid var(--border)', paddingTop: 32 }}>
        <SectionHeading level={3} title="Hyperparameter provenance" />
        <p className="text-sm text-slate-500">
          Each parameter, selected on a held-out prefix and applied unchanged to the 17,344-round window.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse" style={{ minWidth: 640 }}>
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-3 font-semibold text-slate-500 uppercase tracking-wider">Parameter</th>
                <th className="text-right py-2 px-2 font-semibold text-slate-500 uppercase tracking-wider">Synthetic default</th>
                <th className="text-right py-2 px-2 font-semibold text-slate-500 uppercase tracking-wider">Wind tuned</th>
                <th className="text-right py-2 px-2 font-semibold text-slate-500 uppercase tracking-wider">Electricity tuned</th>
                <th className="text-left py-2 pl-3 font-semibold text-slate-500 uppercase tracking-wider">Source / search grid</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums text-slate-700">
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 font-sans">Skill-gate slope γ</td>
                <td className="text-right py-1.5 px-2">4</td>
                <td className="text-right py-1.5 px-2">16</td>
                <td className="text-right py-1.5 px-2">16</td>
                <td className="text-left py-1.5 pl-3 font-sans text-slate-500">Held-out prefix, grid {'{'}4, 8, 16, 32, 64{'}'}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 font-sans">EWMA learning rate ρ</td>
                <td className="text-right py-1.5 px-2">0.1</td>
                <td className="text-right py-1.5 px-2">0.5</td>
                <td className="text-right py-1.5 px-2">0.1</td>
                <td className="text-left py-1.5 pl-3 font-sans text-slate-500">Held-out prefix, grid {'{'}0.1, 0.3, 0.5, 0.7{'}'}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 font-sans">Gate floor λ</td>
                <td className="text-right py-1.5 px-2">0.30</td>
                <td className="text-right py-1.5 px-2">0.05</td>
                <td className="text-right py-1.5 px-2">0.05</td>
                <td className="text-left py-1.5 pl-3 font-sans text-slate-500">Held-out prefix, grid {'{'}0.0, 0.05, 0.10, 0.20{'}'}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 font-sans">Skill exponent η</td>
                <td className="text-right py-1.5 px-2">1</td>
                <td className="text-right py-1.5 px-2">2</td>
                <td className="text-right py-1.5 px-2">2</td>
                <td className="text-left py-1.5 pl-3 font-sans text-slate-500">Pinned in config, not swept on real data</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 font-sans">Lower bound σ<sub>min</sub></td>
                <td className="text-right py-1.5 px-2">0.10</td>
                <td className="text-right py-1.5 px-2">0.10</td>
                <td className="text-right py-1.5 px-2">0.10</td>
                <td className="text-left py-1.5 pl-3 font-sans text-slate-500">Defended in §B.1, keeps every participant in the market</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 font-sans">Staleness decay κ</td>
                <td className="text-right py-1.5 px-2">0.05</td>
                <td className="text-right py-1.5 px-2">0.05</td>
                <td className="text-right py-1.5 px-2">0.05</td>
                <td className="text-left py-1.5 pl-3 font-sans text-slate-500">Half-life ≈ 14 rounds, absentees revert to neutral L₀</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 font-sans">Deposit b<sub>i</sub></td>
                <td className="text-right py-1.5 px-2">f<sub>stake</sub> = 0.30</td>
                <td className="text-right py-1.5 px-2">1 (fixed)</td>
                <td className="text-right py-1.5 px-2">1 (fixed)</td>
                <td className="text-left py-1.5 pl-3 font-sans text-slate-500">Real-data runs fix unit deposits to isolate the skill gate. The synthetic bankroll-confidence stake fraction f<sub>stake</sub> is 0.30</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 pr-3 font-sans">Recalibration buffer K<sub>buf</sub></td>
                <td className="text-right py-1.5 px-2">—</td>
                <td className="text-right py-1.5 px-2">500</td>
                <td className="text-right py-1.5 px-2">500</td>
                <td className="text-left py-1.5 pl-3 font-sans text-slate-500">Kuleshov et al. (2018) and Deshpande et al. (2023) online buffer</td>
              </tr>
              <tr className="border-b border-slate-100 last:border-0">
                <td className="py-1.5 pr-3 font-sans">Recalibration refit period</td>
                <td className="text-right py-1.5 px-2">—</td>
                <td className="text-right py-1.5 px-2">50</td>
                <td className="text-right py-1.5 px-2">50</td>
                <td className="text-left py-1.5 pl-3 font-sans text-slate-500">Refit cadence; rolling isotonic at τ ∈ {'{'}0.1, 0.25, 0.5, 0.75, 0.9{'}'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[13px] text-slate-400 leading-relaxed">
          Coarse grid γ × ρ × λ ∈ {'{'}4, 8, 16, 32, 64{'}'} × {'{'}0.1, 0.3, 0.5, 0.7{'}'} × {'{'}0.05, 0.20{'}'} on η = 2, then a 192-cell refinement around the wind optimum. 60% of refined cells fall within 2 pp of the best at (16, 0.5), so the headline sits on a plateau.
        </p>
      </section>
    </div>
  );
}
