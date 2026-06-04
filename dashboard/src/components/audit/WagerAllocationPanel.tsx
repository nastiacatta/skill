/**
 * WagerAllocationPanel — Effective wager breakdown, weight distribution,
 * deposit policy comparison, concentration metrics, and textual explanation
 * for the audit page.
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useAuditData } from '@/hooks/useAuditData';
import { giniCoefficient, effectiveN } from '@/lib/audit/auditUtils';
import { PALETTE } from '@/lib/palette';
import { Card, SectionHeading, StatTile } from '@/components/platform/ui';

// ════════════════════════════════════════════════════════════════════════════

export default function WagerAllocationPanel() {
  const { comparison } = useAuditData();

  const steadyState = useMemo(() => comparison?.steady_state ?? [], [comparison]);

  // ── Effective wager data (deposit + skill gate) ────────────────
  const wagerBarData = useMemo(() => {
    return [...steadyState]
      .sort((a, b) => b.mean_weight - a.mean_weight)
      .map((s) => ({
        name: s.forecaster,
        deposit: 1.0, // normalised base deposit
        skillGate: s.mean_sigma,
        totalWeight: s.mean_weight,
      }));
  }, [steadyState]);

  // ── Concentration metrics ──────────────────────────────────────
  const weights = steadyState.map((s) => s.mean_weight);
  const gini = giniCoefficient(weights);
  const nEff = effectiveN(weights);

  if (!comparison) {
    return (
      <Card padding="roomy" className="text-center" style={{ borderStyle: 'dashed' }}>
        <p className="text-sm text-slate-400">
          Wager allocation data unavailable.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      {/* ── High-concentration warning ───────────────────────────── */}
      {gini > 0.5 && (
        <Card padding="compact" className="border-amber-200" style={{ background: 'var(--amber-tint)' }}>
          <p className="text-sm font-medium text-amber-800">
            ⚠ High concentration warning: Gini coefficient is{' '}
            {gini.toFixed(3)} (&gt; 0.5). Wager allocation is heavily
            concentrated on a few forecasters.
          </p>
        </Card>
      )}

      {/* ── Effective wager stacked bar chart ────────────────────── */}
      <section className="space-y-4">
        <SectionHeading level={3} title="Effective wager breakdown" />
        <p className="text-sm text-slate-500">
          Effective wager m<sub>i</sub> = b<sub>i</sub> &middot; g(σ<sub>i</sub>) split into deposit b<sub>i</sub> (normalised to 1) and skill gate g(σ<sub>i</sub>).
        </p>
        {wagerBarData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={wagerBarData} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={PALETTE.border}
                horizontal={false}
              />
              <XAxis
                type="number"
                tick={{ fontSize: 14, fill: PALETTE.slate }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 14, fill: PALETTE.charcoal }}
                tickLine={false}
                width={100}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 14,
                  borderRadius: 8,
                  border: `1px solid ${PALETTE.border}`,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Bar
                dataKey="deposit"
                stackId="wager"
                fill={PALETTE.slate}
                name="Deposit"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="skillGate"
                stackId="wager"
                fill={PALETTE.teal}
                name="Skill Gate (σ)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 py-4 text-center">
            Steady-state data not available.
          </p>
        )}
      </section>

      {/* ── Concentration metrics ────────────────────────────────── */}
      <section className="space-y-4">
        <SectionHeading level={3} title="Concentration metrics" />
        <div className="grid grid-cols-2 gap-4">
          <StatTile
            size="lg"
            label="Gini coefficient"
            value={gini.toFixed(3)}
            accent={gini > 0.5 ? 'score' : 'wager'}
            sublabel="0 = equal, 1 = maximally concentrated"
          />
          <StatTile
            size="lg"
            label="Effective N"
            value={nEff.toFixed(2)}
            accent="wager"
            sublabel={`of ${steadyState.length} forecasters`}
          />
        </div>
      </section>

      <p className="text-sm text-slate-500">
        Fixed unit deposits (b<sub>i</sub> = 1) leave the skill gate as the only differentiator. Wealth-scaled deposits are studied on the synthetic panel only. Companion to thesis §4.1.4.
      </p>
    </div>
  );
}
