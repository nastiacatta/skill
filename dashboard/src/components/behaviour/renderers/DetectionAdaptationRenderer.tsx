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

const DETECTION_PALETTE = [PALETTE.imperial, PALETTE.purple, PALETTE.teal, ORANGE, PALETTE.coral];

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

export default function DetectionAdaptationRenderer({ data, header }: RendererProps) {
  const rows = data.detectionAdaptationData.map((row) => ({
    ...row,
    label: scenarioLabel(row.attacker),
  }));

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No detection-adaptation data found." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {header}

      <CardGrid>
        <MetricCard label="Fixed manipulator profit" value={fmtNum(rows.find((d) => d.attacker === 'fixed_manipulator')?.totalProfit, 2)} subtitle="Baseline attacker" />
        <MetricCard label="Adaptive evader profit" value={fmtNum(rows.find((d) => d.attacker === 'adaptive_evader')?.totalProfit, 2)} subtitle="Detector-aware attacker" />
        <MetricCard label="Fixed manipulator wealth" value={fmtNum(rows.find((d) => d.attacker === 'fixed_manipulator')?.finalWealth, 2)} subtitle="Post-attack wealth" />
        <MetricCard label="Adaptive evader wealth" value={fmtNum(rows.find((d) => d.attacker === 'adaptive_evader')?.finalWealth, 2)} subtitle="Post-attack wealth" />
      </CardGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Attacker total profit" subtitle="Fixed manipulator versus adaptive evader">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalProfit" fill={DETECTION_PALETTE[4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Attacker final wealth" subtitle="Economic survival after manipulation">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="finalWealth" fill={DETECTION_PALETTE[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
