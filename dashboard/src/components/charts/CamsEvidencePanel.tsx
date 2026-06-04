import { useEffect, useState } from 'react';
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
import { Card, StatTile, SectionHeading, Tag } from '@/components/platform/ui';
import ThesisRef from '@/components/dashboard/ThesisRef';
import { loadCamsHeadline, type CamsHeadlineResult } from '@/lib/adapters';
import { SEM, METHOD } from '@/lib/tokens';
import { TYPE, SPACE } from '@/components/platform/designTokens';
import {
  AXIS_STROKE,
  AXIS_TICK,
  GRID_PROPS,
  REF_LINE_STROKE,
  TOOLTIP_STYLE,
} from '@/components/lab/shared';

/**
 * CAMS PM2.5 evidence panel (the real artefact surface).
 *
 * Loads the committed `cams_headline.json` (verbatim copy of the download-probe
 * headline metrics) and renders the verified mixture-of-experts replication on
 * the evidence page: the headline reduction, the median baseline, the
 * Diebold-Mariano statistic and weight concentration, the real 12-model
 * mean-weight bar chart, the unit-anchored line, and a draft-pinned day-ahead
 * line. Every rendered figure is read straight from the artefact (no
 * recomputation) except the day-ahead slice, which has no artefact value and is
 * a draft-cited literal.
 *
 * This is the ONLY surface allowed to render the -13.5% headline. The live card
 * surfaces are guarded so the literal never appears there (provenance
 * C12-card-guard). Renders nothing when the artefact is absent.
 */

/** Percentage change of `a` relative to `b`, signed. */
const pctChange = (a: number, b: number) => ((a - b) / b) * 100;

interface WeightRow {
  name: string;
  weight: number;
}

export default function CamsEvidencePanel() {
  const [data, setData] = useState<CamsHeadlineResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCamsHeadline()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  const { panel, block, params, results } = data;

  // Headline reduction, computed live from the two artefact reads (-13.49,
  // displayed as -13.5%).
  const reductionPct = pctChange(results.mean_crps_mechanism, results.mean_crps_uniform);

  // Real 12-model mean weights, sorted descending, labelled by panel member.
  const weightRows: WeightRow[] = panel.forecaster_names
    .map((name) => ({ name, weight: results.mean_weights[name] ?? 0 }))
    .sort((a, b) => b.weight - a.weight);
  const uniformShare = 1 / panel.n_forecasters;

  return (
    <Card padding="roomy" elevation="raised" data-testid="cams-evidence" className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Tag tone="good" size="md">Real data, CAMS PM2.5</Tag>
        <Tag tone="neutral" size="sm">
          {`γ = ${params.gamma}, ρ = ${params.rho}, λ = ${params.lam}, η = ${params.eta}, expanding causal`}
        </Tag>
      </div>

      <SectionHeading
        eyebrow="Replication on a mixture-of-experts panel"
        title={`CAMS Po Valley PM2.5: ${block.n_hours_eval.toLocaleString()}-hour evaluation window`}
        subtitle={`A twelve-member panel of independent chemistry-transport models (eleven CTMs plus the ensemble median as a twelfth member), run on the Po Valley grid cell over ${block.start} to ${block.end}. The skill-gated aggregate is compared against uniform averaging and the per-round median.`}
        level={2}
        as={3}
      />

      <ThesisRef
        viewKey="evidence/cams"
        note="Replication on a mixture-of-experts panel, 60_results_real_data.md claim:moe-panel-replication (real:227-267)"
      />

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
      >
        <div data-testid="cams-headline">
          <StatTile
            label="CRPS reduction vs uniform"
            value={reductionPct.toFixed(1)}
            unit="%"
            size="xl"
            accent="wager"
            delta={{ value: 'vs uniform', direction: 'down' }}
            sublabel={`mechanism ${results.mean_crps_mechanism.toFixed(4)} vs uniform ${results.mean_crps_uniform.toFixed(4)}`}
          />
        </div>
        <StatTile
          label="Median baseline"
          value={results.mean_crps_median.toFixed(4)}
          size="lg"
          accent="outcome"
          sublabel="per-round median, does not beat the mechanism on CAMS"
        />
        <div data-testid="cams-dm">
          <StatTile
            label="Diebold-Mariano"
            value={results.dm_t.toFixed(2)}
            size="lg"
            accent="skill"
            sublabel="t-statistic, p approx 0"
          />
        </div>
        <StatTile
          label="Concentration"
          value={results.effective_n.toFixed(2)}
          size="lg"
          accent="aggregate"
          sublabel={`effective count N_eff = 1/HHI, HHI ${results.herfindahl.toFixed(3)}`}
        />
      </div>

      <div>
        <h4
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: TYPE.h3.size,
            fontWeight: 600,
            color: 'var(--ink)',
            margin: `0 0 ${SPACE[3]}px`,
          }}
        >
          Mean mechanism weight per panel member
        </h4>
        <ResponsiveContainer width="100%" height={Math.max(320, weightRows.length * 26 + 56)}>
          <BarChart
            data={weightRows}
            layout="vertical"
            margin={{ top: 28, right: 56, bottom: 24, left: 12 }}
          >
            <CartesianGrid {...GRID_PROPS} horizontal={false} />
            <XAxis type="number" tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, 'auto']} />
            <YAxis type="category" dataKey="name" tick={AXIS_TICK} stroke={AXIS_STROKE} width={132} />
            <ReferenceLine
              x={uniformShare}
              stroke={REF_LINE_STROKE}
              strokeDasharray="4 4"
              label={{ value: `uniform 1/${panel.n_forecasters}`, position: 'top', fontSize: 12, fill: AXIS_STROKE }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE as React.CSSProperties}
              formatter={(value: unknown) => [`${(Number(value) * 100).toFixed(2)}%`, 'mean weight']}
            />
            <Bar dataKey="weight" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
              {weightRows.map((r) => (
                <Cell key={r.name} fill={SEM.wager.main} opacity={0.9} />
              ))}
              <LabelList
                dataKey="weight"
                position="right"
                formatter={(v: string | number | boolean | null | undefined) => {
                  const n = Number(v);
                  return Number.isFinite(n) ? (n * 100).toFixed(1) : '';
                }}
                style={{ fontSize: 11, fill: METHOD.equal.color }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: TYPE.caption.size,
            lineHeight: TYPE.caption.lineHeight,
            color: 'var(--ink-faint)',
            margin: `${SPACE[2]}px 0 0`,
          }}
        >
          Mean mechanism weight per panel member over the {block.n_hours_eval.toLocaleString()}-hour window. Shares stay near the uniform 1/{panel.n_forecasters}, as predicted for a panel with no dominant best forecaster.
        </p>
      </div>

      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: TYPE.body.size,
          lineHeight: TYPE.body.lineHeight,
          color: 'var(--ink-soft)',
        }}
      >
        <p style={{ margin: `0 0 ${SPACE[3]}px`, maxWidth: '70ch' }} data-testid="cams-ugm3">
          Converted onto the fixed analysis range [{results.pm25_range_lo.toFixed(1)}, {results.pm25_range_hi.toFixed(1)}] µg/m³, the mechanism aggregate sits at {results.mean_crps_mechanism_ugm3.toFixed(1)} µg/m³ against {results.mean_crps_uniform_ugm3.toFixed(1)} µg/m³ for uniform.
        </p>
        <p style={{ margin: `0 0 ${SPACE[3]}px`, maxWidth: '70ch' }}>
          95% block-bootstrap CI on dCRPS [{results.bootstrap_ci_lo.toFixed(5)}, {results.bootstrap_ci_hi.toFixed(5)}] ({params.bootstrap_block_size_hours}-hour blocks, {params.bootstrap_n_replicates.toLocaleString()} resamples). The project's results table omits this CI for CAMS.
        </p>
        <p style={{ margin: 0, maxWidth: '70ch', color: 'var(--ink-faint)' }} data-testid="cams-dayahead">
          On the day-ahead-only horizon slice the reduction holds at about -2.0% (DM t = 1.84, p = 0.066) but the much smaller 61-hour sample leaves it short of standalone significance (project results table, day-ahead slice).
        </p>
      </div>
    </Card>
  );
}
