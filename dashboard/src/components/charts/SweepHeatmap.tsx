import type { SweepPoint } from '@/lib/types';
import ChartCard from '../dashboard/ChartCard';
import MathBlock from '../dashboard/MathBlock';
import { useState, useMemo } from 'react';
import TabGroup from '../dashboard/TabGroup';
import { fmtNum, sweepMetricLabel } from '@/lib/formatters';
import { viridis, scaleToColour } from '@/lib/colourScales';

// Note: Drag-to-zoom is not applicable for this table-based heatmap.
// The heatmap uses HTML table cells, not Recharts, so useChartZoom cannot be applied.

interface Props {
  data: SweepPoint[];
}

/**
 * Builds a CSS linear-gradient string for the colour legend bar,
 * sampling the viridis scale at evenly-spaced stops.
 */
function buildGradient(minVal: number, maxVal: number, stops = 16): string {
  const colours: string[] = [];
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const value = minVal + t * (maxVal - minVal);
    colours.push(scaleToColour(value, minVal, maxVal, viridis));
  }
  return `linear-gradient(to right, ${colours.join(', ')})`;
}

export default function SweepHeatmap({ data }: Props) {
  const [metric, setMetric] = useState<'meanCrps' | 'gini'>('meanCrps');

  const lams = [...new Set(data.map(d => d.lam))].sort((a, b) => a - b);
  const sigmaMins = [...new Set(data.map(d => d.sigmaMin))].sort((a, b) => a - b);

  const values = data.map(d => d[metric]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const midVal = (minVal + maxVal) / 2;

  const legendGradient = useMemo(
    () => buildGradient(minVal, maxVal),
    [minVal, maxVal],
  );

  const cellW = 72;
  const cellH = 40;

  return (
    <ChartCard
      title="Parameter Sweep"
      subtitle={<><MathBlock inline latex="\\lambda" /> vs <MathBlock inline latex="\\sigma_{\\min}" /> — explore the quality–concentration trade-off</>}
      help={{
        term: 'Parameter Sweep',
        definition: 'A grid search over λ (stake weight) and σ_min (minimum skill floor), measuring accuracy (CRPS) and concentration (Gini) at each combination.',
        interpretation: 'Darker cells indicate worse values. The mechanism is not brittle if the colour gradient is smooth rather than having sharp jumps.',
        axes: { x: 'σ_min (minimum skill floor)', y: 'λ (stake weight)' },
      }}
    >
      <TabGroup
        tabs={[
          { id: 'meanCrps', label: 'Mean CRPS' },
          { id: 'gini', label: 'Gini' },
        ]}
        active={metric}
        onChange={(v) => setMetric(v as 'meanCrps' | 'gini')}
      />
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="text-[11px] text-slate-400 p-1"><MathBlock inline latex="\\lambda \\setminus \\sigma_{\\min}" /></th>
              {sigmaMins.map(s => (
                <th key={s} className="text-[11px] text-slate-600 font-medium p-1 text-center" style={{ width: cellW }}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lams.map(l => (
              <tr key={l}>
                <td className="text-[11px] text-slate-600 font-medium p-1 text-right pr-2">{l}</td>
                {sigmaMins.map(s => {
                  const pt = data.find(d => d.lam === l && d.sigmaMin === s);
                  const val = pt ? pt[metric] : 0;
                  return (
                    <td key={s} className="p-0.5">
                      <div
                        className="rounded flex items-center justify-center"
                        style={{
                          width: cellW,
                          height: cellH,
                          background: scaleToColour(val, minVal, maxVal, viridis),
                        }}
                        title={`λ=${l}, σ_min=${s}: ${sweepMetricLabel(metric)}=${fmtNum(val)}`}
                      >
                        <span className="text-[11px] text-white font-mono font-medium">{fmtNum(val, 4)}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Continuous colour legend */}
      <div className="mt-3 flex flex-col items-start">
        <div
          className="rounded"
          style={{
            width: 200,
            height: 16,
            background: legendGradient,
          }}
          aria-label={`Colour legend: ${fmtNum(minVal)} to ${fmtNum(maxVal)}`}
        />
        <div className="flex justify-between" style={{ width: 200 }}>
          <span className="text-[11px] text-slate-500">{fmtNum(minVal)}</span>
          <span className="text-[11px] text-slate-500">{fmtNum(midVal)}</span>
          <span className="text-[11px] text-slate-500">{fmtNum(maxVal)}</span>
        </div>
      </div>
    </ChartCard>
  );
}
