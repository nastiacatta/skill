import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  LabelList,
} from 'recharts';
import ChartCard from '@/components/dashboard/ChartCard';
import {
  AXIS_STROKE,
  AXIS_TICK,
  AXIS_LABEL_FILL,
  CHART_MARGIN_LABELED,
  GRID_PROPS,
  REF_LINE_STROKE,
  TOOLTIP_STYLE,
  fmt,
} from '@/components/lab/shared';

/**
 * Concentration panel — revised (May 2026).
 *
 * Design change: render Gini and N_eff as two separate small-multiples panels
 * rather than three bars on a shared axis. Reasoning:
 *   * Gini is bounded in [0, 1]; N_eff is unbounded in [1, N]; plotting them
 *     on one scale either compresses Gini to invisibility or makes N_eff
 *     appear saturated. Tufte / Wilke "Fundamentals of Data Visualization"
 *     explicitly advises against mixing incommensurable scales.
 *   * HHI ≡ Σ wᵢ² and N_eff ≡ 1/HHI are algebraically redundant; we keep
 *     the more interpretable of the two (N_eff, in "effective forecasters").
 *   * Each panel uses colour-blind-safe Wong palette hues (Wong, 2011,
 *     Nature Methods).
 */

export interface ConcentrationDatum {
  method: string;
  label: string;
  color: string;
  gini?: number;
  hhi?: number;
  nEff?: number;
}

interface ConcentrationPanelProps {
  data: ConcentrationDatum[];
}

const GINI_COLOUR = '#0072B2';  // Wong blue
const NEFF_COLOUR = '#009E73';  // Wong bluish-green

function SmallPanel({
  title,
  subtitle,
  data,
  dataKey,
  colour,
  yDomain,
  yLabel,
  yTickFormatter,
  referenceValue,
  referenceLabel,
  valueFormatter,
}: {
  title: string;
  subtitle: string;
  data: Array<ConcentrationDatum & { [k: string]: unknown }>;
  dataKey: 'gini' | 'nEff';
  colour: string;
  yDomain: [number | 'auto', number | 'auto'];
  yLabel: string;
  yTickFormatter?: (v: number) => string;
  referenceValue?: number;
  referenceLabel?: string;
  valueFormatter: (v: number) => string;
}) {
  const filtered = data.filter((d) => (d[dataKey] as number | undefined) != null);
  if (filtered.length === 0) return null;

  return (
    <div>
      <div className="mb-1.5">
        <h4 className="text-[13px] font-semibold text-slate-800">{title}</h4>
        <p className="text-[11px] text-slate-500 leading-snug">{subtitle}</p>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={filtered}
          margin={{ ...CHART_MARGIN_LABELED, bottom: 28, right: 12 }}
        >
          <CartesianGrid {...GRID_PROPS} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ ...AXIS_TICK, fontSize: 11 }}
            stroke={AXIS_STROKE}
            interval={0}
            angle={filtered.length > 4 ? -20 : 0}
            textAnchor={filtered.length > 4 ? 'end' : 'middle'}
            height={filtered.length > 4 ? 48 : 26}
          />
          <YAxis
            tick={{ ...AXIS_TICK, fontSize: 11 }}
            stroke={AXIS_STROKE}
            domain={yDomain}
            tickFormatter={yTickFormatter}
            label={{
              value: yLabel,
              angle: -90,
              position: 'insideLeft',
              offset: 8,
              fontSize: 11,
              fill: AXIS_LABEL_FILL,
            }}
          />
          {referenceValue != null && (
            <ReferenceLine
              y={referenceValue}
              stroke={REF_LINE_STROKE}
              strokeDasharray="4 4"
              label={{
                value: referenceLabel ?? '',
                position: 'right',
                fontSize: 10,
                fill: AXIS_LABEL_FILL,
              }}
            />
          )}
          <Tooltip
            contentStyle={TOOLTIP_STYLE as React.CSSProperties}
            formatter={(v: unknown) => [valueFormatter(Number(v)), yLabel]}
            cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
          />
          <Bar
            dataKey={dataKey}
            radius={[4, 4, 0, 0]}
            maxBarSize={38}
            isAnimationActive
            animationDuration={250}
          >
            {filtered.map((d) => (
              <Cell key={d.method} fill={d.color || colour} opacity={0.88} />
            ))}
            <LabelList
              dataKey={dataKey}
              position="top"
              formatter={(v: string | number | boolean | null | undefined) => {
                if (v == null) return '';
                return valueFormatter(Number(v));
              }}
              style={{ fontSize: 10, fill: '#334155', fontFamily: 'monospace' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ConcentrationPanel({ data }: ConcentrationPanelProps) {
  const augmented = data.map((d) => ({ ...d })) as Array<ConcentrationDatum & { [k: string]: unknown }>;
  const hasGini = augmented.some((d) => d.gini != null);
  const hasNEff = augmented.some((d) => d.nEff != null);
  const maxNEff = Math.max(...augmented.map((d) => (d.nEff ?? 0)));
  const panelCount = Number(hasGini) + Number(hasNEff);

  return (
    <ChartCard
      title="Weight distribution"
      subtitle="How evenly weight is spread across forecasters. The two panels share the same method ordering on the x-axis."
      help={{
        term: 'Concentration Metrics',
        definition:
          'Gini coefficient measures inequality in the final weight vector (0 = perfectly equal, 1 = one forecaster has everything). N_eff = 1/Σwᵢ² (the effective number of forecasters carrying meaningful weight).',
        interpretation:
          'Lower Gini = fairer distribution. Higher N_eff (closer to the total number of forecasters) = more diverse aggregate. HHI is omitted because N_eff = 1/HHI carries the same information in more interpretable units.',
        axes: { x: 'Method', y: 'Metric value' },
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: panelCount === 2 ? 'repeat(2, minmax(0, 1fr))' : '1fr',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {hasGini && (
          <SmallPanel
            title="Gini coefficient"
            subtitle="Lower is fairer. 0 = uniform, 1 = one forecaster takes all."
            data={augmented}
            dataKey="gini"
            colour={GINI_COLOUR}
            yDomain={[0, 1]}
            yLabel="Gini"
            yTickFormatter={(v) => v.toFixed(1)}
            valueFormatter={(v) => fmt(v, 3)}
          />
        )}
        {hasNEff && (
          <SmallPanel
            title="Effective number of forecasters (N_eff)"
            subtitle="Higher is more diverse. N_eff = 1 / Σ wᵢ²."
            data={augmented}
            dataKey="nEff"
            colour={NEFF_COLOUR}
            yDomain={[0, Math.ceil(maxNEff * 1.1)]}
            yLabel="N_eff"
            yTickFormatter={(v) => v.toFixed(0)}
            referenceValue={maxNEff > 0 ? Math.round(maxNEff) : undefined}
            referenceLabel="uniform"
            valueFormatter={(v) => fmt(v, 2)}
          />
        )}
      </div>
    </ChartCard>
  );
}
