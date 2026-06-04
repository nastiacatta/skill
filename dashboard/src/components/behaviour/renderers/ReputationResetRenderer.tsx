import ChartCard from '@/components/dashboard/ChartCard';
import MetricCard from '@/components/dashboard/MetricCard';
import { fmtNum, scenarioLabel } from '@/lib/formatters';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RendererProps } from './types';
import { PALETTE } from '@/lib/palette';

const COLOURS: Record<string, string> = {
  baseline:             PALETTE.slate,
  manipulator_no_reset: PALETTE.coral,
  reputation_reset:     '#B45309',  // amber
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

/**
 * Whitewashing attack (Feldman & Chuang 2004): a manipulator that
 * abandons a collapsed identity and rejoins as a newcomer. Compare
 * against a fixed-identity manipulator that bankrupts itself.
 */
export default function ReputationResetRenderer({ data, header }: RendererProps) {
  const rows = data.reputationResetData.map((r) => ({
    scenario: r.scenario,
    label: scenarioLabel(r.scenario),
    meanProfit: r.meanAttackerProfit,
    errorBar: [
      r.meanAttackerProfit - r.ciLow,
      r.ciHigh - r.meanAttackerProfit,
    ],
    meanNResets: r.meanNResets,
    nSeeds: r.nSeeds,
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No reputation-reset data." />
      </div>
    );
  }

  const fixed = rows.find((r) => r.scenario === 'manipulator_no_reset');
  const reset = rows.find((r) => r.scenario === 'reputation_reset');
  const savings =
    fixed && reset && fixed.meanProfit !== 0
      ? (reset.meanProfit - fixed.meanProfit) / Math.abs(fixed.meanProfit)
      : null;

  return (
    <div className="space-y-6 p-6">
      {header}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Fixed identity"
          value={fmtNum(fixed?.meanProfit, 2)}
          subtitle="Bankrupt after aggressive manipulation"
        />
        <MetricCard
          label="Whitewash / reset"
          value={fmtNum(reset?.meanProfit, 2)}
          subtitle={
            reset
              ? `${fmtNum(reset.meanNResets, 1)} resets per run`
              : 'Abandons collapsed identity'
          }
          accent
        />
        <MetricCard
          label="Loss avoided"
          value={savings !== null ? `${(savings * 100).toFixed(0)}%` : 'n/a'}
          subtitle="Vs fixed-identity"
        />
      </div>

      <ChartCard
        title="Attacker profit by scenario (mean +/- 95% CI)"
        subtitle="Feldman-Chuang 2004: whitewashing lets an attacker escape past losses by creating a fresh identity"
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip
                formatter={(v: unknown) =>
                  typeof v === 'number' ? fmtNum(v, 2) : String(v ?? '')
                }
              />
              <Bar dataKey="meanProfit">
                {rows.map((r, i) => (
                  <Cell key={i} fill={COLOURS[r.scenario] ?? PALETTE.slate} />
                ))}
                <ErrorBar dataKey="errorBar" width={4} strokeWidth={2} stroke={PALETTE.charcoal} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
