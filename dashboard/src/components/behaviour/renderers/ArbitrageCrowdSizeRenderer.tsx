import ChartCard from '@/components/dashboard/ChartCard';
import MetricCard from '@/components/dashboard/MetricCard';
import { fmtNum } from '@/lib/formatters';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { RendererProps } from './types';
import { PALETTE as PALETTE_SEM } from '@/lib/palette';

// Severity gradient: neutral → amber → coral (matches slide palette).
const SEVERITY_PALETTE = [PALETTE_SEM.slate, '#B45309', PALETTE_SEM.coral];

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

/**
 * 2D sweep: arbitrage profit as a function of the crowd size and lambda.
 * Larger crowds produce more disagreement, which grows the arbitrage
 * interval.
 */
export default function ArbitrageCrowdSizeRenderer({ data, header }: RendererProps) {
  const rows = data.arbitrageCrowdSizeData;
  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No crowd-size sweep data." />
      </div>
    );
  }

  const lams = Array.from(new Set(rows.map((r) => r.lam))).sort((a, b) => a - b);
  const ns = Array.from(new Set(rows.map((r) => r.nBenign))).sort((a, b) => a - b);

  // Wide-format rows: one row per n_benign, columns for each lam.
  const byN: Record<number, Record<string, number>> = {};
  for (const r of rows) {
    byN[r.nBenign] ??= { nBenign: r.nBenign };
    byN[r.nBenign][`lam_${r.lam}`] = r.meanProfit;
  }
  const chartRows = ns.map((n) => ({ label: `n = ${n}`, ...byN[n] }));

  // Headline: scaling ratio n=32/n=4 at the highest lambda.
  const lamMax = Math.max(...lams);
  const smallestN = Math.min(...ns);
  const largestN = Math.max(...ns);
  const smallest = rows.find((r) => r.lam === lamMax && r.nBenign === smallestN);
  const largest = rows.find((r) => r.lam === lamMax && r.nBenign === largestN);
  const ratio =
    smallest && largest && smallest.meanProfit !== 0
      ? largest.meanProfit / smallest.meanProfit
      : null;

  return (
    <div className="space-y-6 p-6">
      {header}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label={`lambda = ${lamMax.toFixed(1)} at n = ${smallestN}`}
          value={fmtNum(smallest?.meanProfit, 2)}
          subtitle="Baseline crowd"
        />
        <MetricCard
          label={`lambda = ${lamMax.toFixed(1)} at n = ${largestN}`}
          value={fmtNum(largest?.meanProfit, 2)}
          subtitle="Larger crowd"
          accent
        />
        <MetricCard
          label="Scaling ratio"
          value={ratio !== null ? `${ratio.toFixed(1)}x` : 'n/a'}
          subtitle="Profit scales with disagreement"
        />
      </div>

      <ChartCard
        title="Arbitrage profit vs crowd size"
        subtitle="A larger benign crowd means more within-crowd disagreement, which widens the arbitrage interval"
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip
                formatter={(v: unknown) =>
                  typeof v === 'number' ? fmtNum(v, 2) : String(v ?? '')
                }
              />
              {lams.map((lam, i) => (
                <Bar
                  key={lam}
                  dataKey={`lam_${lam}`}
                  name={`lambda = ${lam}`}
                  fill={SEVERITY_PALETTE[i % SEVERITY_PALETTE.length]}
                >
                  {chartRows.map((_, j) => (
                    <Cell key={j} fill={SEVERITY_PALETTE[i % SEVERITY_PALETTE.length]} />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
