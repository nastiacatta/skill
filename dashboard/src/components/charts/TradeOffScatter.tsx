import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  type LabelProps,
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

export interface TradeOffPoint {
  /** Internal method key */
  method: string;
  /** Display label */
  label: string;
  /** X-axis: CRPS improvement (positive = better) */
  crpsImprovement: number;
  /** Y-axis: Gini coefficient (lower = better) */
  gini: number;
  /** Point colour */
  color: string;
}

interface TradeOffScatterProps {
  data: TradeOffPoint[];
  /** Optional title override */
  title?: string;
  /** Data provenance badge */
  provenance?: DataProvenance;
}

/* ── Custom label renderer for scatter points ──────────────────────── */

const LABEL_HEIGHT = 14; // approximate height of a label in px

/**
 * Greedy non-overlap label placement.
 *
 * Recharts calls the `label` renderer once per data point within a single
 * render pass, but never guarantees ordering or pass-scoped state. To avoid
 * cross-render leakage the caller creates a fresh {@link LabelPlacer} per
 * render and hands it to the renderer.
 */
class LabelPlacer {
  private used: number[] = [];
  place(desiredY: number): number {
    for (let attempt = 0; attempt < 20; attempt++) {
      const offset =
        attempt === 0
          ? 0
          : (attempt % 2 === 1 ? Math.ceil(attempt / 2) : -Math.ceil(attempt / 2)) * LABEL_HEIGHT;
      const candidate = desiredY + offset;
      if (this.used.every((u) => Math.abs(u - candidate) >= LABEL_HEIGHT)) {
        this.used.push(candidate);
        return candidate;
      }
    }
    this.used.push(desiredY);
    return desiredY;
  }
}

function renderPointLabel(
  props: LabelProps & { index?: number },
  data: TradeOffPoint[],
  placer: LabelPlacer,
) {
  const { x, y, index } = props;
  if (index == null || !data[index]) return null;
  const point = data[index];
  const px = Number(x);
  const py = Number(y);

  const adjustedY = placer.place(py + 4);

  return (
    <text
      x={px + 14}
      y={adjustedY}
      textAnchor="start"
      fill={point.color}
      fontSize={11}
      fontWeight={600}
    >
      {point.label}
    </text>
  );
}

/* ── Custom active shape for scatter dots ──────────────────────────── */

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: TradeOffPoint;
}

function renderDot(props: DotProps) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={8}
      fill={payload.color}
      stroke="#fff"
      strokeWidth={2}
      opacity={0.9}
    />
  );
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function TradeOffScatter({
  data,
  title = 'Accuracy vs Concentration Trade-off',
  provenance,
}: TradeOffScatterProps) {
  // Fresh placer per render prevents stale state leaking between renders.
  const placer = new LabelPlacer();

  // Compute midpoints for quadrant reference lines
  const xValues = data.map((d) => d.crpsImprovement);
  const yValues = data.map((d) => d.gini);
  const xMid = xValues.length > 0 ? (Math.min(...xValues) + Math.max(...xValues)) / 2 : 0;
  const yMid = yValues.length > 0 ? (Math.min(...yValues) + Math.max(...yValues)) / 2 : 0.5;

  return (
    <ChartCard
      title={title}
      subtitle="Each point is one aggregation method. Further right means more accurate, further down means more evenly distributed weight. The bottom-right quadrant is ideal."
      provenance={provenance}
      help={{
        term: 'Accuracy vs concentration trade-off',
        definition:
          'A scatter plot pairing each method\u2019s accuracy gain (CRPS improvement over equal weighting) with its weight concentration (Gini coefficient on the final weight vector).',
        interpretation:
          'Points in the bottom-right combine high accuracy with low concentration \u2014 the ideal outcome. Points in the top-left are both less accurate and more concentrated.',
        axes: {
          x: 'CRPS improvement (positive = better than equal weighting)',
          y: 'Gini coefficient (lower = less concentrated)',
        },
      }}
      chartType="Scatter chart"
    >
      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 28, right: 96, bottom: 36, left: 32 }}>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            type="number"
            dataKey="crpsImprovement"
            name="CRPS Improvement"
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            domain={['dataMin - 0.001', 'dataMax + 0.001']}
            tickFormatter={(v: number) => fmt(v, 3)}
            label={{
              value: 'Accuracy gain →',
              position: 'insideBottom',
              offset: -4,
              fontSize: 11,
              fill: AXIS_LABEL_FILL,
            }}
          />
          <YAxis
            type="number"
            dataKey="gini"
            name="Gini"
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            domain={['dataMin - 0.02', 'dataMax + 0.02']}
            tickFormatter={(v: number) => fmt(v, 2)}
            label={{
              value: '← Fairer',
              angle: -90,
              position: 'insideLeft',
              offset: 4,
              fontSize: 11,
              fill: AXIS_LABEL_FILL,
            }}
          />
          {/* Quadrant dividers */}
          <ReferenceLine x={xMid} stroke={REF_LINE_STROKE} strokeOpacity={0.45} strokeDasharray="4 4" />
          <ReferenceLine y={yMid} stroke={REF_LINE_STROKE} strokeOpacity={0.45} strokeDasharray="4 4" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE as React.CSSProperties}
            formatter={(value: unknown, name: unknown) => {
              const v = Number(value);
              const label = name === 'CRPS Improvement' ? 'CRPS Δ' : 'Gini';
              return [Number.isFinite(v) ? fmt(v, 4) : '—', label];
            }}
            labelFormatter={(_label, payload) => {
              const items = payload as ReadonlyArray<{ payload?: TradeOffPoint }>;
              const point = items?.[0]?.payload;
              return point?.label ?? '';
            }}
          />
          <Scatter
            data={data}
            shape={renderDot}
            label={(props: LabelProps & { index?: number }) => renderPointLabel(props, data, placer)}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
