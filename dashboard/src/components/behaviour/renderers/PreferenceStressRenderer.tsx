import ChartCard from '@/components/dashboard/ChartCard';
import MetricCard from '@/components/dashboard/MetricCard';
import { fmtNum, scenarioLabel } from '@/lib/formatters';
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts';
import type { RendererProps } from './types';
import { PALETTE, ORANGE } from '@/lib/palette';

const PREF_PALETTE = [PALETTE.imperial, PALETTE.purple, PALETTE.teal, ORANGE];

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

export default function PreferenceStressRenderer({ data, header }: RendererProps) {
  const rows = data.preferenceStressData.map((row) => ({
    ...row,
    label: scenarioLabel(row.scenario),
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No preference stress data found." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {header}

      <CardGrid>
        <MetricCard label="Truthfulness gap" value={fmtNum(rows[0]?.totalProfit - (rows[1]?.totalProfit ?? 0), 2)} subtitle="Truthful minus hedged profit" />
        <MetricCard label="Truthful Gini" value={fmtNum(rows.find((d) => d.scenario === 'truthful')?.finalGini, 3)} subtitle="Concentration under truthful reports" />
        <MetricCard label="Hedged Gini" value={fmtNum(rows.find((d) => d.scenario === 'hedged')?.finalGini, 3)} subtitle="Concentration under risk aversion" />
        <MetricCard label="Summary Gini" value={fmtNum(data.summary?.finalGini, 3)} subtitle="Overall concentration" />
      </CardGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Total profit" subtitle="Truthful versus hedged">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalProfit" fill={PREF_PALETTE[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Final Gini" subtitle="Preference-sensitive concentration effect">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="finalGini" fill={PREF_PALETTE[3]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
