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
import { PALETTE } from '@/lib/palette';

const LINE_PALETTE = [PALETTE.teal];

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

export default function StrategicReportingRenderer({ data, header }: RendererProps) {
  const rows = data.strategicReportingData.map((row) => ({
    ...row,
    label: scenarioLabel(row.scenario),
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No strategic reporting data." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {header}
      <ChartCard title="Mean aggregate error by scenario">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="meanAggError" fill={LINE_PALETTE[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
