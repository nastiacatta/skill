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

const PALETTE = ['#7c3aed'];

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

export default function StakePolicyRenderer({ data, header }: RendererProps) {
  const rows = data.stakePolicyData.map((row) => ({
    ...row,
    label: scenarioLabel(row.staking),
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No stake policy data." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {header}
      <ChartCard title="Total profit by staking policy">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" angle={-15} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalProfit" fill={PALETTE[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
