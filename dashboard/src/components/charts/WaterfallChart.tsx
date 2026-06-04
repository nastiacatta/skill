import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
  TOOLTIP_STYLE,
  fmt,
} from '@/components/lab/shared';
import { PALETTE } from '@/lib/palette';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface WaterfallDatum {
  /** Step label */
  label: string;
  /** Absolute value at this step */
  value: number;
  /** Change from previous step */
  delta: number;
  /** If true, bar starts from zero (total bar) */
  isTotal?: boolean;
}

interface WaterfallChartProps {
  data: WaterfallDatum[];
  /** Y-axis label */
  metricLabel?: string;
  /** Optional title override */
  title?: string;
  /** Data provenance badge */
  provenance?: DataProvenance;
}

/* ── Colours ───────────────────────────────────────────────────────── */

// Palette-anchored. Teal for improvement, coral for degradation, navy for totals.
// Previously used Wong (2011) blue/vermillion — still colour-blind safe because
// teal vs coral is the same hue contrast the slide palette already uses.
const COLOUR_IMPROVE = PALETTE.teal;
const COLOUR_DEGRADE = PALETTE.coral;
const COLOUR_TOTAL   = PALETTE.navy;

/* ── Component ─────────────────────────────────────────────────────── */

export default function WaterfallChart({
  data,
  metricLabel = 'CRPS',
  title = 'Waterfall — Incremental Changes',
  provenance,
}: WaterfallChartProps) {
  /*
   * Stacked bar trick: each bar is composed of an invisible "base" segment
   * and a visible "delta" segment. For total bars, base = 0 and delta = value.
   * For incremental bars, base = min(value, value - delta) and
   * delta = |delta|.
   */
  const chartData = data.map((d) => {
    if (d.isTotal) {
      return {
        name: d.label,
        base: 0,
        delta: d.value,
        rawDelta: d.delta,
        isTotal: true,
      };
    }

    const prevValue = d.value - d.delta;
    const base = Math.min(prevValue, d.value);
    const absDelta = Math.abs(d.delta);

    return {
      name: d.label,
      base,
      delta: absDelta,
      rawDelta: d.delta,
      isTotal: false,
    };
  });

  const getFill = (row: (typeof chartData)[number]) => {
    if (row.isTotal) return COLOUR_TOTAL;
    return row.rawDelta <= 0 ? COLOUR_IMPROVE : COLOUR_DEGRADE;
  };

  return (
    <ChartCard
      title={title}
      subtitle="Each step turns on one component of the mechanism. Blue bars show the change in mean CRPS at that step (shorter bars = closer to the oracle)."
      provenance={provenance}
      help={{
        term: 'Waterfall chart',
        definition:
          'Shows how an initial value is successively moved up or down by a sequence of factors.',
        interpretation:
          'Blue bars indicate improvements (negative Δ, lower CRPS). Orange bars indicate degradations (positive Δ, higher CRPS). Navy bars are absolute totals at that stage. Colours follow the Wong (2011) palette, which remains distinguishable under protanopia and deuteranopia.',
        axes: { x: 'Step', y: metricLabel },
      }}
      chartType="Bar chart"
    >
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 28, right: 28, bottom: 16, left: 32 }}
        >
          <CartesianGrid {...GRID_PROPS} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ ...AXIS_TICK, fontSize: 10 }}
            stroke={AXIS_STROKE}
            interval={0}
            height={68}
            angle={-30}
            textAnchor="end"
          />
          <YAxis
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            label={{
              value: metricLabel,
              angle: -90,
              position: 'insideLeft',
              offset: 8,
              fontSize: 11,
              fill: AXIS_LABEL_FILL,
            }}
          />
          <ReferenceLine y={0} stroke={AXIS_STROKE} strokeDasharray="4 4" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE as React.CSSProperties}
            formatter={(_value: unknown, name: unknown, props: { payload?: (typeof chartData)[number] }) => {
              const row = props.payload;
              if (!row) return ['—', ''];
              if (name === 'base') return ['', ''];
              const sign = row.rawDelta <= 0 ? '' : '+';
              return [
                `${sign}${fmt(row.rawDelta, 4)} (total: ${fmt(row.base + row.delta, 4)})`,
                row.isTotal ? 'Total' : 'Δ',
              ];
            }}
            itemStyle={{ fontSize: 11 }}
          />
          {/* Invisible base bar */}
          <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
          {/* Visible delta bar */}
          <Bar
            dataKey="delta"
            stackId="waterfall"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            isAnimationActive={true}
            animationDuration={300}
          >
            {chartData.map((d, i) => (
              <Cell key={`${d.name}-${i}`} fill={getFill(d)} opacity={0.9} />
            ))}
            <LabelList
              dataKey="delta"
              position="top"
              content={(props: {
                x?: number | string;
                y?: number | string;
                width?: number | string;
                index?: number;
              }) => {
                const x = typeof props.x === 'number' ? props.x : Number(props.x);
                const y = typeof props.y === 'number' ? props.y : Number(props.y);
                const w = typeof props.width === 'number' ? props.width : Number(props.width);
                const { index } = props;
                if (index == null || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w)) {
                  return null;
                }
                const row = chartData[index];
                if (!row) return null;
                const text = row.isTotal
                  ? fmt(row.delta, 4)
                  : `${row.rawDelta <= 0 ? '' : '+'}${fmt(row.rawDelta, 4)}`;
                return (
                  <text
                    x={x + w / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#334155"
                    fontFamily="monospace"
                  >
                    {text}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
