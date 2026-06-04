import { useMemo } from 'react';
import { BarChart, Bar, CartesianGrid, ReferenceLine, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import { CHART_MARGIN_LABELED, AXIS_TICK, AXIS_STROKE, AXIS_LABEL_FILL, GRID_PROPS, REF_LINE_STROKE, TOOLTIP_STYLE } from '@/components/lab/shared';

interface FamilyImpactChartProps {
  data: Array<{ family: string; worstDeltaCrpsPct: number; color: string }>;
}

export default function FamilyImpactChart({ data }: FamilyImpactChartProps) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => Math.abs(b.worstDeltaCrpsPct) - Math.abs(a.worstDeltaCrpsPct)),
    [data],
  );

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 32)}>
      <BarChart data={sorted} layout="vertical" margin={CHART_MARGIN_LABELED}>
        <CartesianGrid {...GRID_PROPS} horizontal={false} />
        <XAxis
          type="number"
          tick={AXIS_TICK}
          stroke={AXIS_STROKE}
          tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`}
          label={{
            value: 'Worst Δ CRPS (%)',
            position: 'insideBottom',
            offset: -8,
            fontSize: 14,
            fill: AXIS_LABEL_FILL,
          }}
        />
        <YAxis
          type="category"
          dataKey="family"
          tick={AXIS_TICK}
          stroke={AXIS_STROKE}
          width={110}
          style={{ textTransform: 'capitalize' }}
        />
        <ReferenceLine x={0} stroke={REF_LINE_STROKE} strokeDasharray="4 4" />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(v: unknown) => [`${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2)}%`, 'Worst Δ CRPS']}
        />
        <Bar dataKey="worstDeltaCrpsPct" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {sorted.map((entry) => (
            <Cell key={entry.family} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
