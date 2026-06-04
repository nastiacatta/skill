/**
 * Sensitivity analysis panel (academic redesign).
 *
 * Line chart per parameter showing ΔCRPS variation using Recharts.
 * Highlights crossover points with vertical reference lines.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { SensitivitySummary } from '../../lib/analysis/types';
import { TOOLTIP_STYLE } from '@/components/lab/shared';

interface SensitivityPanelProps {
  summary: SensitivitySummary;
}

const PARAM_COLORS: Record<string, string> = {
  lam:       '#1d3461', // navy
  sigmaMin:  '#b45309', // amber
  eta:       '#0f766e', // teal
  gamma:     '#5b21b6', // plum
  n:         '#9a1a2f', // crimson
  T:         '#115e59', // deep teal
};

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 18,
  boxShadow: 'var(--shadow-sm)',
};

function PanelHeader({
  title,
  accent = 'var(--navy)',
}: {
  title: string;
  accent?: string;
}) {
  return (
    <h3
      className="font-serif flex items-center gap-2.5 mb-4 tracking-tight"
      style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}
    >
      <span
        aria-hidden="true"
        className="inline-block"
        style={{ width: 3, height: 16, background: accent, borderRadius: 2 }}
      />
      {title}
    </h3>
  );
}

export default function SensitivityPanel({ summary }: SensitivityPanelProps) {
  const { points, crossoverPoints, summaryText } = summary;

  if (points.length === 0) {
    return (
      <div style={CARD_STYLE}>
        <PanelHeader title="Sensitivity analysis" />
        <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No sweep data available.</p>
      </div>
    );
  }

  const paramNames = [...new Set(points.map((p) => p.paramName))];

  return (
    <div style={CARD_STYLE}>
      <PanelHeader title="Sensitivity analysis" />

      <div className="space-y-5">
        {paramNames.map((paramName) => {
          const paramPoints = points
            .filter((p) => p.paramName === paramName)
            .sort((a, b) => a.paramValue - b.paramValue);

          const paramCrossovers = crossoverPoints.filter((c) => c.paramName === paramName);
          const color = PARAM_COLORS[paramName] ?? 'var(--ink-muted)';

          return (
            <div key={paramName}>
              <p
                className="font-mono mb-1"
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-muted)' }}
              >
                {paramName}
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart
                  data={paramPoints}
                  margin={{ top: 8, right: 12, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.7} />
                  <XAxis
                    dataKey="paramValue"
                    tick={{ fontSize: 10, fill: '#5a6175' }}
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#5a6175' }}
                    tickLine={false}
                    axisLine={{ stroke: '#d1d5db' }}
                    tickFormatter={(v: number) => v.toFixed(3)}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: unknown) => [
                      typeof value === 'number' ? value.toFixed(4) : String(value),
                      'ΔCRPS',
                    ]}
                    labelFormatter={(label: unknown) => `${paramName} = ${label}`}
                  />
                  <ReferenceLine y={0} stroke="#8c92a3" strokeDasharray="3 3" />
                  {paramCrossovers.map((c, i) => (
                    <ReferenceLine
                      key={i}
                      x={c.value}
                      stroke="var(--crimson)"
                      strokeDasharray="4 2"
                      label={{
                        value: `crossover ≈ ${c.value.toFixed(3)}`,
                        position: 'top',
                        fontSize: 9,
                        fill: '#9a1a2f',
                      }}
                    />
                  ))}
                  <Line
                    type="monotone"
                    dataKey="deltaCrps"
                    stroke={color}
                    strokeWidth={2}
                    dot={{ r: 3, fill: color, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>

      <p
        className="mt-4 pt-4"
        style={{
          fontSize: 13,
          color: 'var(--ink-muted)',
          lineHeight: 1.6,
          borderTop: '1px solid var(--border)',
        }}
      >
        {summaryText}
      </p>
    </div>
  );
}
