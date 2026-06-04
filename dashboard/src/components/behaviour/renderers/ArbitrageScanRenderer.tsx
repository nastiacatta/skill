import ChartCard from '@/components/dashboard/ChartCard';
import MetricCard from '@/components/dashboard/MetricCard';
import { fmtNum } from '@/lib/formatters';
import {
  ResponsiveContainer,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import type { RendererProps } from './types';
import { PALETTE, ORANGE } from '@/lib/palette';

const LINE_PALETTE = [PALETTE.imperial, PALETTE.purple, PALETTE.teal, ORANGE, PALETTE.coral];

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

export default function ArbitrageScanRenderer({ data, header }: RendererProps) {
  const rows = data.arbitrageScanData;

  if (rows.length === 0) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message="No arbitrage scan data found." />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {header}

      <CardGrid>
        <MetricCard label="Best arb profit" value={fmtNum(Math.max(...rows.map((d) => d.arbTotalProfit)), 2)} subtitle="Across λ values" />
        <MetricCard label="Best arb wealth" value={fmtNum(Math.max(...rows.map((d) => d.arbFinalWealth)), 2)} subtitle="Final wealth ceiling" />
        <MetricCard label="Most arb rounds" value={String(Math.max(...rows.map((d) => d.arbitrageFoundRounds)))} subtitle="Detected opportunities" />
        <MetricCard label="Rows" value={String(rows.length)} subtitle="Grid points in the scan" />
      </CardGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Arbitrage profit against λ" subtitle="Where skill × stake becomes exploitable">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="lam" label={{ value: 'λ', position: 'insideBottom', offset: -4, fontSize: 14 }} />
                <YAxis label={{ value: 'Total profit', angle: -90, position: 'insideLeft', fontSize: 14 }} />
                <Tooltip formatter={(v: unknown) => typeof v === 'number' ? fmtNum(v, 3) : String(v ?? '')} />
                <Legend />
                <Line type="monotone" dataKey="arbTotalProfit" name="Attacker total profit" stroke={LINE_PALETTE[4]} strokeWidth={2} dot />
                <Line type="monotone" dataKey="arbFinalWealth" name="Attacker final wealth" stroke={LINE_PALETTE[0]} strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Arbitrage rounds found" subtitle="Count of rounds with a detectable arbitrage opportunity">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="lam" label={{ value: 'λ', position: 'insideBottom', offset: -4, fontSize: 14 }} />
                <YAxis label={{ value: 'Arbitrage rounds (count)', angle: -90, position: 'insideLeft', fontSize: 14 }} />
                <Tooltip />
                <Line type="monotone" dataKey="arbitrageFoundRounds" name="Arbitrage rounds" stroke={LINE_PALETTE[1]} strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
