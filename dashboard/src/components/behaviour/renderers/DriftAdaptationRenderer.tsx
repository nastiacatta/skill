import ChartCard from '@/components/dashboard/ChartCard';
import { scenarioLabel } from '@/lib/formatters';
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

const PALETTE = ['#2563eb'];

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

export default function DriftAdaptationRenderer({ data, header }: RendererProps) {
  const rows = data.driftAdaptationData.map((row) => ({
    ...row,
    label: scenarioLabel(row.belief),
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No drift adaptation data." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {header}
      <ChartCard title="Mean MAE by belief model">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="meanMae" fill={PALETTE[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
