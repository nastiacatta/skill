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

const PALETTE = ['#0d9488'];

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

export default function WashActivityRenderer({ data, header }: RendererProps) {
  const rows = data.washActivityData.map((row) => ({
    ...row,
    label: scenarioLabel(row.scenario),
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No wash activity data." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {header}
      <ChartCard title="Total activity by scenario">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalActivity" fill={PALETTE[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
