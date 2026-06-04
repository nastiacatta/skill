import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceArea } from 'recharts';
import type { ForecastSeriesPoint } from '@/lib/types';
import { WEIGHTING_COLORS, metricLabel } from '@/lib/formatters';
import {
  AXIS_STROKE,
  AXIS_TICK,
  AXIS_LABEL_FILL,
  GRID_PROPS,
  REF_BAND_FILL,
  TOOLTIP_STYLE,
} from '@/components/lab/shared';
import ChartCard from '../dashboard/ChartCard';
import ZoomBadge from './ZoomBadge';
import { useState, useCallback } from 'react';
import TabGroup from '../dashboard/TabGroup';
import { useChartZoom } from '@/hooks/useChartZoom';

interface Props {
  data: ForecastSeriesPoint[];
}

export default function ForecastQualityChart({ data }: Props) {
  const [mode, setMode] = useState<'rolling' | 'cumulative'>('cumulative');
  const zoom = useChartZoom();

  const keys = mode === 'cumulative'
    ? ['crpsUniformCum', 'crpsDepositCum', 'crpsSkillCum', 'crpsMechanismCum', 'crpsBestSingleCum'] as const
    : ['crpsUniform', 'crpsDeposit', 'crpsSkill', 'crpsMechanism', 'crpsBestSingle'] as const;

  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const toggleSeries = useCallback((dataKey: string) => {
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  }, []);

  return (
    <ChartCard
      title="Aggregate Forecast Quality"
      subtitle={<>CRPS across weighting rules: lower is better. Drag to zoom. <ZoomBadge isZoomed={zoom.state.isZoomed} onReset={zoom.reset} /></>}
      help={{
        term: 'Aggregate Forecast Quality',
        definition: 'Continuous Ranked Probability Score (CRPS) measures how close each method\'s probabilistic forecast is to the realised outcome.',
        interpretation: 'Lower CRPS means better accuracy. The mechanism line (Skill × stake) should track below baselines if the project claim holds.',
        axes: { x: 'Round', y: 'CRPS (lower is better)' },
      }}
    >
      <TabGroup
        tabs={[
          { id: 'cumulative', label: 'Cumulative' },
          { id: 'rolling', label: 'Per-round' },
        ]}
        active={mode}
        onChange={(v) => setMode(v as 'rolling' | 'cumulative')}
      />
      <div className="cursor-crosshair">
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={data}
          syncId="round-window"
          margin={{ top: 12, right: 28, bottom: 32, left: 44 }}
          onMouseDown={zoom.onMouseDown}
          onMouseMove={zoom.onMouseMove}
          onMouseUp={zoom.onMouseUp}
        >
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="t"
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            domain={[zoom.state.left, zoom.state.right]}
            label={{ value: 'Round', position: 'insideBottom', offset: -8, fontSize: 12, fill: AXIS_LABEL_FILL }}
          />
          <YAxis
            tick={AXIS_TICK}
            stroke={AXIS_STROKE}
            label={{ value: 'CRPS', angle: -90, position: 'insideLeft', offset: 4, fontSize: 12, fill: AXIS_LABEL_FILL }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE as React.CSSProperties}
            formatter={(value: unknown, name: unknown) => [typeof value === 'number' ? value.toFixed(5) : String(value ?? ''), metricLabel(String(name ?? ''))]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, cursor: 'pointer', paddingTop: 8 }}
            formatter={(v: string) => metricLabel(v)}
            onClick={(e) => {
              if (e?.dataKey) toggleSeries(String(e.dataKey));
            }}
          />
          {keys.map(key => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={WEIGHTING_COLORS[key]}
              strokeWidth={key.includes('Mechanism') || key.includes('mechanism') ? 3 : 1.5}
              dot={false}
              strokeOpacity={key.includes('Mechanism') || key.includes('mechanism') ? 1 : 0.75}
              hide={hiddenSeries.has(key)}
              isAnimationActive={true}
              animationDuration={300}
            />
          ))}
          {zoom.state.refLeft && zoom.state.refRight && (
            <ReferenceArea x1={zoom.state.refLeft} x2={zoom.state.refRight} strokeOpacity={0.3} fill={REF_BAND_FILL} fillOpacity={0.1} />
          )}
        </LineChart>
      </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
