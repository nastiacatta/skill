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
} from 'recharts';
import type { RendererProps } from './types';

const PALETTE = ['#2563eb', '#7c3aed', '#0d9488'];

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

export default function IntermittencyStressRenderer({ data, header }: RendererProps) {
  const rows = data.intermittencyStressData.map((row) => ({
    ...row,
    label: scenarioLabel(row.mode),
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No intermittency stress data found." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {header}

      <CardGrid>
        <MetricCard label="Highest participation" value={fmtPct(Math.max(...rows.map((d) => d.participationRate)))} subtitle="Across participation regimes" />
        <MetricCard label="Lowest participation" value={fmtPct(Math.min(...rows.map((d) => d.participationRate)))} subtitle="Across participation regimes" />
        <MetricCard label="Best N_eff" value={fmtNum(Math.max(...rows.map((d) => d.finalNEff)), 1)} subtitle="Effective active base" />
        <MetricCard label="Mean N_t" value={fmtNum(data.summary?.meanNt, 2)} subtitle="Mean active participants" />
      </CardGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Participation rate by regime" subtitle="IID, bursty, edge-threshold, avoid-skill-decay">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" angle={-15} textAnchor="end" height={70} interval={0} />
                <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip formatter={(v: unknown) => (typeof v === 'number' ? fmtPct(v) : String(v ?? ''))} />
                <Bar dataKey="participationRate" fill={PALETTE[2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Final N_eff by regime" subtitle="Weight concentration under missingness">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" angle={-15} textAnchor="end" height={70} interval={0} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="finalNEff" fill={PALETTE[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
