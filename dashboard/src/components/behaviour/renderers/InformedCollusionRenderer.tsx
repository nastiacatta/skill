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
  baseline:           PALETTE.slate,
  collusion_only:     PALETTE.purple,
  informed_collusion: PALETTE.coral,
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

/**
 * Informed collusion combines Chun-Shachter coalition aggregation with
 * per-member privileged-information signals on an AR(1) DGP.
 */
export default function InformedCollusionRenderer({ data, header }: RendererProps) {
  const rows = data.informedCollusionData.map((r) => ({
    scenario: r.scenario,
    label: scenarioLabel(r.scenario),
    meanProfit: r.meanCoalitionProfit,
    errorBar: [
      r.meanCoalitionProfit - r.ciLow,
      r.ciHigh - r.meanCoalitionProfit,
    ],
    nSeeds: r.nSeeds,
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No informed collusion data." />
      </div>
    );
  }

  const baseline = rows.find((r) => r.scenario === 'baseline');
  const collusionOnly = rows.find((r) => r.scenario === 'collusion_only');
  const informed = rows.find((r) => r.scenario === 'informed_collusion');
  const boost =
    collusionOnly && informed && collusionOnly.meanProfit !== 0
      ? (informed.meanProfit - collusionOnly.meanProfit) / Math.abs(collusionOnly.meanProfit)
      : null;

  return (
    <div className="space-y-6 p-6">
      {header}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Baseline"
          value={fmtNum(baseline?.meanProfit, 2)}
          subtitle="No adversary"
        />
        <MetricCard
          label="Collusion only"
          value={fmtNum(collusionOnly?.meanProfit, 2)}
          subtitle="Chun-Shachter coalition"
        />
        <MetricCard
          label="Informed collusion"
          value={fmtNum(informed?.meanProfit, 2)}
          subtitle={
            boost !== null
              ? `+${(boost * 100).toFixed(0)}% over pure collusion`
              : 'Coalition + lagged insider signal'
          }
          accent
        />
      </div>

      <ChartCard
        title="Coalition profit by scenario (mean +/- 95% CI)"
        subtitle="Combining collusion with privileged information compounds both attack vectors"
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
