import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Customized,
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
  REF_LINE_STROKE,
  TOOLTIP_STYLE,
  fmt,
} from '@/components/lab/shared';

export interface DeltaBarDatum {
  label: string;
  delta: number;
  se?: number;
  color: string;
}

interface DeltaBarChartProps {
  data: DeltaBarDatum[];
  /** Label for the zero reference line */
  baselineLabel?: string;
  /** X-axis label */
  metricLabel?: string;
  /** Optional title override for the chart card */
  title?: string;
  /** Data provenance badge */
  provenance?: DataProvenance;
}

/** Sorted data row with rank badge text for the Y-axis label. */
interface SortedRow {
  name: string;
  delta: number;
  se: number;
  color: string;
  rank: string;
}

/** Check whether any row has a meaningful (> 0) standard error. */
function hasAnySE(rows: SortedRow[]): boolean {
  return rows.some((r) => r.se > 0);
}

/** Determine if a bar's 95% CI excludes zero → statistically significant. */
import { isSignificant, ciBounds } from './deltaBarHelpers';

/**
 * Hex colour → rgba at given opacity.
 * Falls back to the raw colour string if parsing fails.
 */
function hexToRgba(hex: string, opacity: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${opacity})`;
}

/**
 * Custom SVG layer rendered via Recharts `<Customized>`.
 * Draws horizontal whisker error bars (95% CI) for each bar.
 */
function ErrorBarsLayer(props: Record<string, unknown>) {
  const formattedGraphicalItems = props.formattedGraphicalItems as
    | Array<{ props: { data: Array<{ x: number; y: number; width: number; height: number; payload: SortedRow }> } }>
    | undefined;

  if (!formattedGraphicalItems?.length) return null;

  const barData = formattedGraphicalItems[0]?.props?.data;
  if (!barData?.length) return null;

  const xAxisMap = props.xAxisMap as Record<string, { scale: (v: number) => number }> | undefined;
  if (!xAxisMap) return null;
  const xAxis = Object.values(xAxisMap)[0];
  if (!xAxis?.scale) return null;

  const whiskerCap = 6; // half-height of the cap line in px

  return (
    <g className="error-bars-layer">
      {barData.map((entry) => {
        const { payload } = entry;
        if (!payload || payload.se <= 0) return null;

        const [lo, hi] = ciBounds(payload.delta, payload.se);
        const xLo = xAxis.scale(lo);
        const xHi = xAxis.scale(hi);
        const cy = entry.y + entry.height / 2;
        const strokeColor = hexToRgba(payload.color, 0.7);

        return (
          <g key={payload.name}>
            {/* Horizontal line spanning the CI */}
            <line
              x1={xLo}
              y1={cy}
              x2={xHi}
              y2={cy}
              stroke={strokeColor}
              strokeWidth={1.5}
            />
            {/* Left whisker cap */}
            <line
              x1={xLo}
              y1={cy - whiskerCap}
              x2={xLo}
              y2={cy + whiskerCap}
              stroke={strokeColor}
              strokeWidth={1.5}
            />
            {/* Right whisker cap */}
            <line
              x1={xHi}
              y1={cy - whiskerCap}
              x2={xHi}
              y2={cy + whiskerCap}
              stroke={strokeColor}
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </g>
  );
}

export default function DeltaBarChart({
  data,
  baselineLabel = 'Baseline (equal)',
  metricLabel = 'Δ CRPS (×10⁴)',
  title,
  provenance,
}: DeltaBarChartProps) {
  // Sort ascending by delta (most negative = best accuracy first)
  const sorted: SortedRow[] = [...data]
    .sort((a, b) => a.delta - b.delta)
    .map((d, i) => ({
      name: d.label,
      delta: d.delta,
      se: d.se ?? 0,
      color: d.color,
      rank: `#${i + 1}`,
    }));

  const showErrorBars = hasAnySE(sorted);

  // Build Y-axis labels: append * for significant results
  const displayData = sorted.map((d) => ({
    ...d,
    displayName:
      d.se > 0 && isSignificant(d.delta, d.se) ? `${d.name} *` : d.name,
  }));

  return (
    <ChartCard
      title={title ?? "Accuracy Ranking"}
      subtitle="Horizontal bars show the change in mean CRPS versus equal weighting. Bars to the left of zero are better than the baseline."
      provenance={provenance}
      help={{
        term: 'Delta Bar Chart',
        definition:
          'Horizontal bars showing the difference in accuracy (ΔCRPS) relative to the equal-weighting baseline for each method.',
        interpretation:
          'Negative values (bars extending left) indicate better accuracy than equal weighting. Methods are ranked from best (top) to worst (bottom).' +
          (showErrorBars
            ? ' Error bars show the 95% confidence interval (±1.96 × SE). An asterisk (*) marks methods whose CI does not cross zero, i.e. the improvement is statistically significant.'
            : ''),
        axes: { x: metricLabel, y: 'Method (ranked)' },
      }}
    >
      <ResponsiveContainer width="100%" height={Math.max(280, sorted.length * 56 + 48)}>
        <BarChart
          data={displayData}
          layout="vertical"
          margin={{ top: 16, right: 56, bottom: 32, left: 12 }}
        >
          <CartesianGrid {...GRID_PROPS} horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            label={{
              value: metricLabel,
              position: 'insideBottom',
              offset: -8,
              fontSize: 13,
              fill: AXIS_LABEL_FILL,
            }}
          />
          <YAxis
            type="category"
            dataKey="displayName"
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            width={148}
          />
          <ReferenceLine
            x={0}
            stroke={REF_LINE_STROKE}
            strokeDasharray="4 4"
            label={{
              value: baselineLabel,
              position: 'top',
              fontSize: 12,
              fill: AXIS_LABEL_FILL,
            }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE as React.CSSProperties}
            formatter={(value: unknown, _name: unknown, props: { payload?: SortedRow & { displayName: string } }) => {
              const v = Number(value);
              const se = props.payload?.se;
              if (se && se > 0) {
                const [lo, hi] = ciBounds(v, se);
                return [
                  `${Number.isFinite(v) ? fmt(v, 2) : '—'} [${fmt(lo, 2)}, ${fmt(hi, 2)}]`,
                  'Δ vs baseline (95% CI)',
                ];
              }
              return [
                `${Number.isFinite(v) ? fmt(v, 2) : '—'} points`,
                'Δ vs baseline',
              ];
            }}
          />
          <Bar
            dataKey="delta"
            radius={[0, 4, 4, 0]}
            maxBarSize={34}
            isAnimationActive={true}
            animationDuration={300}
          >
            {displayData.map((d) => (
              <Cell key={d.name} fill={d.color} opacity={0.9} />
            ))}
            <LabelList
              dataKey="delta"
              position="right"
              formatter={(v: string | number | boolean | null | undefined) => {
                const n = Number(v);
                return Number.isFinite(n) ? fmt(n, 3) : '—';
              }}
              style={{ fontSize: 11, fill: '#334155' }}
            />
          </Bar>
          {showErrorBars && (
            <Customized component={ErrorBarsLayer} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
