import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Customized } from 'recharts';
import type { CalibrationPoint } from '@/lib/types';
import ChartCard from '../dashboard/ChartCard';
import ZoomBadge from './ZoomBadge';
import { useChartZoom } from '@/hooks/useChartZoom';
import { PALETTE } from '@/lib/palette';
import {
  AXIS_STROKE,
  AXIS_TICK,
  AXIS_LABEL_FILL,
  GRID_PROPS,
  REF_LINE_STROKE,
  REF_BAND_FILL,
  TOOLTIP_STYLE,
} from '@/components/lab/shared';

interface Props {
  data: CalibrationPoint[];
}

/** Teal for well-calibrated points (matches slide palette). */
const COLOUR_CALIBRATED = PALETTE.teal;
/** Coral for miscalibrated points (|pHat - tau| > 0.05). */
const COLOUR_MISCALIBRATED = PALETTE.coral;

/**
 * Custom shape renderer for scatter points.
 * Renders miscalibrated points (|pHat - tau| > 0.05) in amber,
 * well-calibrated points in blue.
 */
function CalibrationDot(props: Record<string, unknown>) {
  const { cx, cy, payload } = props as {
    cx: number;
    cy: number;
    payload: CalibrationPoint;
  };
  if (cx == null || cy == null || !payload) return null;

  const isMiscalibrated = Math.abs(payload.pHat - payload.tau) > 0.05;
  const fill = isMiscalibrated ? COLOUR_MISCALIBRATED : COLOUR_CALIBRATED;

  return <circle cx={cx} cy={cy} r={4} fill={fill} />;
}

/**
 * SVG layer that draws a shaded ±0.05 band around the y=x diagonal.
 * Uses the Recharts internal xAxisMap/yAxisMap to convert data coords to pixels.
 */
function CalibrationBand(props: Record<string, unknown>) {
  const { xAxisMap, yAxisMap } = props as {
    xAxisMap?: Record<string, { scale: (v: number) => number }>;
    yAxisMap?: Record<string, { scale: (v: number) => number }>;
  };

  if (!xAxisMap || !yAxisMap) return null;

  const xAxis = Object.values(xAxisMap)[0];
  const yAxis = Object.values(yAxisMap)[0];
  if (!xAxis?.scale || !yAxis?.scale) return null;

  const toX = (v: number) => xAxis.scale(v);
  const toY = (v: number) => yAxis.scale(v);

  // Build polygon points for the ±0.05 band around y=x.
  // Upper edge: y = x + 0.05 (clamped to [0,1])
  // Lower edge: y = x - 0.05 (clamped to [0,1])
  // We trace the upper edge left-to-right, then the lower edge right-to-left.
  const steps = 50;
  const upperPoints: string[] = [];
  const lowerPoints: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const x = i / steps;
    const yUpper = Math.min(1, Math.max(0, x + 0.05));
    const yLower = Math.min(1, Math.max(0, x - 0.05));
    upperPoints.push(`${toX(x)},${toY(yUpper)}`);
    lowerPoints.push(`${toX(x)},${toY(yLower)}`);
  }

  // Polygon: upper edge left→right, then lower edge right→left
  const polygonPoints = [...upperPoints, ...lowerPoints.reverse()].join(' ');

  return (
    <polygon
      points={polygonPoints}
      fill={REF_LINE_STROKE}
      fillOpacity={0.1}
      stroke="none"
    />
  );
}

export default function CalibrationChart({ data }: Props) {
  const zoom = useChartZoom();

  return (
    <ChartCard
      title="Reliability Diagram"
      subtitle={<>Coverage vs nominal quantile, perfect calibration follows the diagonal. Drag to zoom. <ZoomBadge isZoomed={zoom.state.isZoomed} onReset={zoom.reset} /></>}
      help={{
        term: 'Reliability Diagram',
        definition: 'Plots observed coverage (p̂) against nominal quantile (τ). If forecasts are perfectly calibrated, points lie on the diagonal.',
        interpretation: 'Points above the diagonal mean the forecast is under-confident, below means over-confident. Closer to the diagonal is better.',
        axes: { x: 'Nominal τ', y: 'Observed p̂' },
      }}
    >
      <div className="cursor-crosshair">
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart
          margin={{ top: 12, right: 24, bottom: 28, left: 32 }}
          onMouseDown={zoom.onMouseDown}
          onMouseMove={zoom.onMouseMove}
          onMouseUp={zoom.onMouseUp}
        >
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="tau"
            type="number"
            domain={zoom.state.isZoomed ? [zoom.state.left, zoom.state.right] : [0, 1]}
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            label={{ value: 'Nominal τ', position: 'insideBottom', offset: -12, fontSize: 11, fill: AXIS_LABEL_FILL }}
          />
          <YAxis
            dataKey="pHat"
            type="number"
            domain={[0, 1]}
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            label={{ value: 'Observed p̂', angle: -90, position: 'insideLeft', offset: 10, fontSize: 11, fill: AXIS_LABEL_FILL }}
          />
          <Customized component={CalibrationBand} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke={REF_LINE_STROKE} strokeDasharray="4 4" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE as React.CSSProperties}
            formatter={(value: unknown) => typeof value === 'number' ? value.toFixed(3) : String(value ?? '')}
          />
          <Scatter
            data={data}
            fill={COLOUR_CALIBRATED}
            shape={<CalibrationDot />}
            isAnimationActive={true}
            animationDuration={300}
          />
          {zoom.state.refLeft && zoom.state.refRight && (
            <ReferenceArea x1={zoom.state.refLeft} x2={zoom.state.refRight} strokeOpacity={0.3} fill={REF_BAND_FILL} fillOpacity={0.1} />
          )}
        </ScatterChart>
      </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
