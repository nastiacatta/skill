import ChartCard from '@/components/dashboard/ChartCard';
import MetricCard from '@/components/dashboard/MetricCard';
import { fmtNum, fmtPct, scenarioLabel } from '@/lib/formatters';
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import type { RendererProps } from './types';
import { PALETTE } from '@/lib/palette';

const COLOUR_BASELINE = PALETTE.slate;
const COLOUR_ATTACK   = PALETTE.coral;

function isAttack(scenario: string): boolean {
  return scenario === 'collusion';
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

export default function CollusionStressRenderer({ data, header }: RendererProps) {
  const rows = data.collusionStressData.map((row) => ({
    ...row,
    label: scenarioLabel(row.scenario),
    colour: isAttack(row.scenario) ? COLOUR_ATTACK : COLOUR_BASELINE,
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No collusion stress data." />
      </div>
    );
  }

  const collusion = rows.find((d) => d.scenario === 'collusion');
  const baseline  = rows.find((d) => d.scenario === 'no_collusion');

  /* total_profit lives at machine-precision noise under budget balance.
     The discriminating metrics here are final_gini (does the colluding
     group concentrate wealth?) and participation_rate (do they flood
     rounds to dilute others?). Show those up front; keep profit only
     as a "still zero-sum" sanity check below. */
  return (
    <div className="space-y-6 p-6">
      {header}
      <CardGrid>
        <MetricCard label="Scenarios" value={String(rows.length)} subtitle="Baseline vs collusion" />
        <MetricCard
          label="Baseline Gini"
          value={fmtNum(baseline?.finalGini, 3)}
          subtitle="No collusion"
        />
        <MetricCard
          label="Collusion Gini"
          value={fmtNum(collusion?.finalGini, 3)}
          subtitle="Colluding group"
          accent
        />
        <MetricCard
          label="Collusion participation"
          value={fmtPct(collusion?.participationRate)}
          subtitle="Share of rounds the attacker joins"
        />
      </CardGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Final wealth concentration (Gini)" subtitle="Higher under collusion means the attacker group is extracting more of the wealth">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v: unknown) => typeof v === 'number' ? fmtNum(v, 3) : String(v ?? '')} />
                <Bar dataKey="finalGini">
                  {rows.map((r, i) => <Cell key={i} fill={r.colour} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Participation rate" subtitle="Fraction of rounds the scenario's agents were active">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 1]} tickFormatter={(v: number) => fmtPct(v) ?? String(v)} />
                <Tooltip formatter={(v: unknown) => typeof v === 'number' ? fmtPct(v) : String(v ?? '')} />
                <Bar dataKey="participationRate">
                  {rows.map((r, i) => <Cell key={i} fill={r.colour} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard
        title="Total profit by scenario"
        subtitle="Both scenarios at machine-precision noise, budget balance preserved under collusion"
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={(v: number) => v.toExponential(1)} />
              <Tooltip formatter={(v: unknown) => typeof v === 'number' ? v.toExponential(3) : String(v ?? '')} />
              <Bar dataKey="totalProfit">
                {rows.map((r, i) => <Cell key={i} fill={r.colour} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
