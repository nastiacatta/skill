import ChartCard from '@/components/dashboard/ChartCard';
import MetricCard from '@/components/dashboard/MetricCard';
import { fmtNum } from '@/lib/formatters';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RendererProps } from './types';
import { PALETTE } from '@/lib/palette';

const COLOUR = PALETTE.coral;

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

/**
 * Sybil-proofness audit against the Chen-Devanur arbitrage attack.
 * If Lambert's invariance holds we expect mean profit to be
 * invariant across k (within Monte-Carlo error).
 */
export default function SybilArbitrageRenderer({ data, header }: RendererProps) {
  const rows = data.sybilArbitrageData.map((r) => ({
    k: r.k,
    label: `k = ${r.k}`,
    meanProfit: r.meanProfit,
    // Recharts ErrorBar wants [low, high] distances from the point
    errorBar: [
      r.meanProfit - r.ciLow,
      r.ciHigh - r.meanProfit,
    ],
    meanNEff: r.meanNEff,
    nSeeds: r.nSeeds,
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No sybil arbitrage data." />
      </div>
    );
  }

  // Quick invariance check: max-min range of mean profits relative to the mean.
  const means = rows.map((r) => r.meanProfit);
  const spread = Math.max(...means) - Math.min(...means);
  const mean = means.reduce((a, b) => a + b, 0) / means.length;
  const invarianceRatio = mean !== 0 ? Math.abs(spread / mean) : 0;
  const invariantWithinSE = rows.every((r) =>
    Math.abs(r.meanProfit - mean) < (r.errorBar[1] + r.errorBar[0])
  );

  return (
    <div className="space-y-6 p-6">
      {header}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="k values tested"
          value={rows.map((r) => r.k).join(', ')}
          subtitle="Sybil splits of same total stake"
        />
        <MetricCard
          label="Mean profit across k"
          value={fmtNum(mean, 2)}
          subtitle="Lambert invariance => invariant"
          accent
        />
        <MetricCard
          label="Empirical spread / mean"
          value={fmtNum(invarianceRatio, 3)}
          subtitle={invariantWithinSE ? 'within SE: narrow sybil invariance holds' : 'outside SE: check'}
        />
      </div>

      <ChartCard
        title="Arbitrage profit vs number of sybil accounts (k)"
        subtitle="Lambert et al. 2008 narrow sybil invariance: profit should be invariant to identity splits that conserve total wager"
      >
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip
                formatter={(v: unknown) =>
                  typeof v === 'number' ? fmtNum(v, 3) : String(v ?? '')
                }
              />
              <Bar dataKey="meanProfit" fill={COLOUR}>
                <ErrorBar dataKey="errorBar" width={4} strokeWidth={2} stroke={PALETTE.charcoal} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard
        title="Effective number of accounts (N_eff) vs k"
        subtitle="Inflates as expected with k, with no payoff consequence under narrow sybil invariance"
      >
        <div className="h-64">
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
              <Bar dataKey="meanNEff" fill={PALETTE.navy} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
