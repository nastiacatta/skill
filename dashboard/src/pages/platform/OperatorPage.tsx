import { useMemo, useState } from 'react';
import PlatformLayout from '@/components/platform/PlatformLayout';
import { Card, StatTile, SectionHeading, Tag, Button } from '@/components/platform/ui';
import TrajectoryChart from '@/components/platform/viz/TrajectoryChart';
import QuantileFan from '@/components/platform/viz/QuantileFan';
import ChartScroller from '@/components/platform/viz/ChartScroller';
import ThesisRef from '@/components/dashboard/ThesisRef';
import HowToRead from '@/components/dashboard/HowToRead';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { cumulative } from '@/components/platform/derivedMetrics';
import { TYPE, SPACE } from '@/components/platform/designTokens';
import { METHOD } from '@/lib/tokens';
import { TAUS, type DGPId } from '@/lib/coreMechanism/dgpSimulator';

/**
 * Operator / client view. An operator runs the panel; a client consumes the
 * published aggregate. The view runs the SAME synthetic series under the full
 * mechanism and under uniform weights and plots the rolling aggregate CRPS
 * (the `error` field of PipelineRoundResult) for each. On a heterogeneous panel
 * the mechanism gap opens; on a near-homogeneous panel it closes - the
 * conditional-claim message (draft 60_results_real_data.md:166-192).
 *
 * The published aggregate fan is the q̂(τ_k) the client would consume.
 */
const PANELS: { id: DGPId; label: string; note: string }[] = [
  { id: 'latent_fixed', label: 'Heterogeneous panel', note: 'Forecasters differ in precision - like the wind panel.' },
  { id: 'baseline', label: 'Near-homogeneous panel', note: 'Forecasters are similar - like the electricity panel.' },
];

export default function OperatorPage() {
  const [dgpId, setDgpId] = useState<DGPId>('latent_fixed');
  const [n, setN] = useState(6);

  // Two runs on the same seed/series: full mechanism vs uniform weights.
  const { mechErr, uniErr, lastTrace, summaryMech, summaryUni } = useMemo(() => {
    const common = { dgpId, behaviourPreset: 'baseline' as const, rounds: 80, seed: 42, n };
    const mech = runPipeline({ ...common, weighting: 'full' });
    const uni = runPipeline({ ...common, weighting: 'uniform' });
    return {
      mechErr: mech.rounds.map((r) => r.error),
      uniErr: uni.rounds.map((r) => r.error),
      lastTrace: mech.traces[mech.traces.length - 1],
      summaryMech: mech.summary,
      summaryUni: uni.summary,
    };
  }, [dgpId, n]);

  // Rolling mean aggregate CRPS (cumulative mean) for a stable, readable trend.
  const rollingMean = (errs: number[]) => {
    const cum = cumulative(errs);
    return cum.map((c, i) => c / (i + 1));
  };
  const mechRoll = useMemo(() => rollingMean(mechErr), [mechErr]);
  const uniRoll = useMemo(() => rollingMean(uniErr), [uniErr]);

  const meanGapPct = summaryUni.meanError > 0
    ? ((summaryMech.meanError - summaryUni.meanError) / summaryUni.meanError) * 100
    : 0;

  return (
    <PlatformLayout>
      <SectionHeading
        as={1}
        eyebrow="Operator and client"
        title="Skill weighting pays off only when the panel differs in quality"
        subtitle="The same series, run under the full mechanism and under uniform weights. On a heterogeneous panel the mechanism's aggregate CRPS pulls ahead. On a near-homogeneous panel the two converge, and the pool clears the same either way."
        companion={<ThesisRef viewKey="platform/operator" />}
      />

      <HowToRead
        id="operator-crps"
        points={[
          "Each point compares a panel's mechanism error against equal weighting.",
          'Lower is better. The gain depends on how much the forecasters disagree.',
        ]}
      />

      <p className="eyebrow" style={controlEyebrow}>Compare panels</p>
      <div style={{ display: 'flex', gap: SPACE[3], flexWrap: 'wrap', marginTop: SPACE[2], alignItems: 'center' }}>
        {PANELS.map((p) => (
          <Button key={p.id} size="md" variant={dgpId === p.id ? 'primary' : 'secondary'} onClick={() => setDgpId(p.id)}>
            {p.label}
          </Button>
        ))}
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)' }}>
          {PANELS.find((p) => p.id === dgpId)?.note}
        </span>
      </div>

      <div style={{ display: 'flex', gap: SPACE[4], alignItems: 'center', marginTop: SPACE[4] }}>
        <label style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.label.size, fontWeight: 600, color: 'var(--ink-soft)' }}>
          Panel size: {n}
        </label>
        <input type="range" min={3} max={12} step={1} value={n} onChange={(e) => setN(parseInt(e.target.value, 10))} aria-label="Panel size" style={{ flex: '1 1 200px', maxWidth: 320 }} />
      </div>

      <Card elevation="raised" padding="roomy" style={{ marginTop: SPACE[6] }}>
        <h2 style={cardHeading}>Rolling aggregate CRPS: mechanism vs uniform</h2>
        <ChartScroller label="Rolling aggregate CRPS, mechanism versus uniform">
          <TrajectoryChart
            ariaLabel="Rolling aggregate CRPS, mechanism versus uniform"
            series={[
              { label: 'mechanism', data: mechRoll, colour: METHOD.blended.color },
              { label: 'uniform', data: uniRoll, colour: METHOD.equal.color, dash: '6 4' },
            ]}
            yLabel="aggregate CRPS (lower better)"
            data-testid="operator-crps-chart"
          />
        </ChartScroller>
      </Card>

      <SectionHeading level={3} eyebrow="At a glance" title="Panel summary" className="mt-12" />
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: SPACE[4], marginTop: SPACE[4] }}
      >
        <StatTile
          label="Mechanism vs uniform"
          value={`${meanGapPct >= 0 ? '+' : ''}${meanGapPct.toFixed(1)}`}
          unit="%"
          accent="aggregate"
          delta={{ value: meanGapPct < 0 ? 'better' : 'no gain', direction: meanGapPct < 0 ? 'down' : 'flat' }}
          sublabel="mean aggregate CRPS gap"
          data-testid="operator-gap"
        />
        <StatTile label="Effective count N_eff" value={lastTrace ? lastTrace.nEff.toFixed(2) : '0'} accent="skill" sublabel="weight is not collapsing" />
        <StatTile label="HHI" value={lastTrace ? lastTrace.hhi.toFixed(3) : '0'} accent="wager" sublabel="&Sigma; w_i&sup2;" />
      </div>

      <SectionHeading level={3} title="The published aggregate the client consumes" className="mt-12" />
      <Card elevation="raised" padding="roomy" style={{ marginTop: SPACE[5] }}>
        {lastTrace && (
          <ChartScroller label="Published aggregate quantile fan">
            <QuantileFan
              quantiles={lastTrace.r_hat_q}
              taus={TAUS}
              outcome={lastTrace.y}
              title="Published aggregate q&#770;(&tau;)"
              ariaLabel="Published aggregate quantile fan"
              data-testid="operator-published-fan"
            />
          </ChartScroller>
        )}
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)', margin: `${SPACE[3]}px 0 0` }}>
          The client sees only the published aggregate, never the raw member
          reports. Post-hoc recalibration, if applied, sits outside settlement
          and never feeds back into the skill estimate.
        </p>
      </Card>

      <div style={{ marginTop: SPACE[6], display: 'flex', gap: SPACE[3], alignItems: 'center', flexWrap: 'wrap' }}>
        <Tag tone="caution" size="sm">Synthetic sandbox</Tag>
        <a href="#/evidence" style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--imperial)' }}>
          See wind vs electricity in the evidence
        </a>
      </div>

      {/* Off-path branch: a clear onward step back to the guided journey. */}
      <nav
        aria-label="Continue the tour"
        style={{ marginTop: SPACE[8], paddingTop: SPACE[5], borderTop: '1px solid var(--border)' }}
      >
        <Button as="a" href="#/evidence" size="md" variant="secondary">
          Continue: the evidence &rarr;
        </Button>
      </nav>
    </PlatformLayout>
  );
}

const cardHeading: React.CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: TYPE.h3.size, fontWeight: 600, color: 'var(--ink)', margin: `0 0 ${SPACE[4]}px` };
const controlEyebrow: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontSize: TYPE.label.size, fontWeight: 600, color: 'var(--teal-deep)', margin: `${SPACE[6]}px 0 0`, textTransform: 'uppercase', letterSpacing: '0.12em' };
