import ChartCard from '@/components/dashboard/ChartCard';
import { scenarioLabel, fmtNum } from '@/lib/formatters';
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

/* Colour palette — neutral baseline vs highlight for attack scenarios */
const COLOUR_BASELINE = PALETTE.slate;   // neutral
const COLOUR_ATTACK   = PALETTE.coral;   // highlight

function isAttack(identity: string): boolean {
  return /sybil|collusive/i.test(identity);
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

export default function IdentityAttackRenderer({ data, header }: RendererProps) {
  const rows = data.identityAttackData.map((row) => ({
    ...row,
    label: scenarioLabel(row.identity),
    colour: isAttack(row.identity) ? COLOUR_ATTACK : COLOUR_BASELINE,
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No identity attack data." />
      </div>
    );
  }

  /* total_profit is at machine-precision noise across all scenarios
     (budget balance is enforced) — surfacing it alone on a bar chart
     hides that the discriminating metrics are final_n_eff and
     final_gini. Show both side by side instead, with profits as a
     sanity-check footnote. */
  return (
    <div className="space-y-6 p-6">
      {header}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Effective participants (N_eff) by identity scenario"
          subtitle="Sybil splits mechanically inflate N_eff because each clone is counted separately"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" angle={-15} textAnchor="end" height={60} interval={0} />
                <YAxis />
                <Tooltip
                  formatter={(v: unknown) =>
                    typeof v === 'number' ? fmtNum(v, 2) : String(v ?? '')
                  }
                />
                <Bar dataKey="finalNEff">
                  {rows.map((r, i) => (
                    <Cell key={i} fill={r.colour} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Final wealth concentration (Gini) by identity scenario"
          subtitle="Higher Gini under sybil attacks reflects wealth dispersed across the attacker's clones"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" angle={-15} textAnchor="end" height={60} interval={0} />
                <YAxis />
                <Tooltip
                  formatter={(v: unknown) =>
                    typeof v === 'number' ? fmtNum(v, 3) : String(v ?? '')
                  }
                />
                <Bar dataKey="finalGini">
                  {rows.map((r, i) => (
                    <Cell key={i} fill={r.colour} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard
        title="Total profit by identity scenario"
        subtitle="All scenarios at machine-precision noise, budget balance holds across identity strategies"
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" angle={-15} textAnchor="end" height={60} interval={0} />
              <YAxis tickFormatter={(v: number) => v.toExponential(1)} />
              <Tooltip
                formatter={(v: unknown) =>
                  typeof v === 'number' ? v.toExponential(3) : String(v ?? '')
                }
              />
              <Bar dataKey="totalProfit">
                {rows.map((r, i) => (
                  <Cell key={i} fill={r.colour} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
