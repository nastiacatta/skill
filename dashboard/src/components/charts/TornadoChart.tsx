import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartCard from '@/components/dashboard/ChartCard';
import type { DataProvenance } from '@/components/dashboard/ChartCard';
import {
  AXIS_STROKE,
  AXIS_TICK,
  AXIS_LABEL_FILL,
  GRID_PROPS,
  REF_LINE_STROKE,
  TOOLTIP_STYLE,
  fmt,
} from '@/components/lab/shared';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface TornadoDatum {
  /** Row label (e.g. method or behaviour preset name) */
  label: string;
  /** Negative = beneficial, positive = harmful */
  delta: number;
  /** Optional grouping family */
  family?: string;
  /** Bar colour */
  color: string;
}

interface TornadoChartProps {
  data: TornadoDatum[];
  /** Label for the zero reference line */
  baselineLabel?: string;
  /** X-axis label */
  metricLabel?: string;
  /** Optional title override */
  title?: string;
  /** Data provenance badge */
  provenance?: DataProvenance;
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function TornadoChart({
  data,
  baselineLabel = 'Baseline',
  metricLabel = 'Δ CRPS',
  title = 'Sensitivity Tornado',
  provenance,
}: TornadoChartProps) {
  // Sort by absolute delta magnitude — largest impact at top
  const sorted = [...data].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const chartData = sorted.map((d) => ({
    name: d.label,
    delta: d.delta,
    family: d.family,
    color: d.color,
  }));

  return (
    <ChartCard
      title={title}
      subtitle="Bars extend left (beneficial) or right (harmful) from the baseline."
      provenance={provenance}
      help={{
        term: 'Tornado Chart',
        definition:
          'A horizontal diverging bar chart showing the magnitude and direction of each factor\'s effect relative to a baseline.',
        interpretation:
          'Bars extending left indicate improvements (negative Δ). Bars extending right indicate degradations (positive Δ). Factors are sorted by absolute impact, largest at top.',
        axes: { x: metricLabel, y: 'Factor' },
      }}
      chartType="Bar chart"
    >
      <ResponsiveContainer width="100%" height={Math.max(280, sorted.length * 48 + 48)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 16, right: 52, bottom: 28, left: 12 }}
        >
          <CartesianGrid {...GRID_PROPS} horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            label={{
              value: metricLabel,
              position: 'insideBottom',
              offset: -6,
              fontSize: 11,
              fill: AXIS_LABEL_FILL,
            }}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            width={140}
          />
          <ReferenceLine
            x={0}
            stroke={REF_LINE_STROKE}
            strokeDasharray="4 4"
            label={{
              value: baselineLabel,
              position: 'top',
              fontSize: 11,
              fill: AXIS_LABEL_FILL,
            }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE as React.CSSProperties}
            formatter={(value: unknown) => {
              const v = Number(value);
              return [
                Number.isFinite(v) ? fmt(v, 3) : '—',
                metricLabel,
              ];
            }}
          />
          <Bar
            dataKey="delta"
            radius={[0, 4, 4, 0]}
            maxBarSize={32}
            isAnimationActive={true}
            animationDuration={300}
          >
            {chartData.map((d) => (
              <Cell key={d.name} fill={d.color} opacity={0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
