import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PlatformLayout from '@/components/platform/PlatformLayout';
import { Card, StatTile, SectionHeading, Tag, Button } from '@/components/platform/ui';
import MarketFloor from '@/components/platform/market/MarketFloor';
import ChartScroller from '@/components/platform/viz/ChartScroller';
import MarketLegend from '@/components/platform/market/MarketLegend';
import TransportControls from '@/components/platform/market/TransportControls';
import StepRibbon, { STEP_CAPTIONS, STEP_CONCEPTS, STEP_LABELS } from '@/components/platform/viz/StepRibbon';
import StoryNav from '@/components/platform/StoryNav';
import ThesisRef from '@/components/dashboard/ThesisRef';
import HowToRead from '@/components/dashboard/HowToRead';
import { SEM } from '@/lib/tokens';
import {
  useMarketSimulation,
  type MarketEvent,
} from '@/components/platform/hooks/useMarketSimulation';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { budgetBalanceResidual } from '@/components/platform/derivedMetrics';
import { PANEL_FRAMINGS, DEFAULT_FRAMING, type PanelFraming } from '@/components/platform/panelFramings';
import { TYPE, SPACE } from '@/components/platform/designTokens';
import { forecasterLabel, forecasterColour } from '@/components/platform/forecasterIdentity';
import type { InfluenceRule } from '@/lib/coreMechanism/runRoundComposable';

/**
 * Live round / market view. A panel runs round after round; the visitor plays,
 * pauses, steps and scrubs, switches the panel type, changes the skill gate,
 * and injects events. Every number traces to a real trace value from the
 * running pipeline. The view opens paused on round 1 so a first-time viewer
 * can read each round at a readable pace before pressing play.
 */
const EVENTS: { id: MarketEvent; label: string; note: string }[] = [
  { id: 'none', label: 'Calm market', note: 'Baseline panel, no injected behaviour.' },
  { id: 'sybil', label: 'Sybil split', note: 'Two identities split one forecaster (diversified-report case).' },
  { id: 'reputation_reset', label: 'Degrading forecaster', note: 'F1 builds skill, then degrades after round 100.' },
  { id: 'manipulator', label: 'Manipulator', note: 'F1 pushes reports away from the consensus.' },
];

const INFLUENCE: { id: InfluenceRule; label: string }[] = [
  { id: 'skill_stake', label: 'Full mechanism' },
  { id: 'uniform', label: 'Uniform weights' },
  { id: 'skill_only', label: 'Skill-only' },
];

export default function MarketPage() {
  // The chooser's wind / electricity cards deep-link here with ?panel=<id>, so
  // the Market opens on the matching framing from first paint. Absent or
  // unrecognised falls back to DEFAULT_FRAMING (wind-like), byte-identical to
  // the prior default, so the no-param case is unchanged.
  const [searchParams] = useSearchParams();
  const initialFraming =
    PANEL_FRAMINGS.find((f) => f.id === searchParams.get('panel')) ?? DEFAULT_FRAMING;

  const sim = useMarketSimulation({
    rounds: 80,
    dgpId: initialFraming.dgpId,
    ...(initialFraming.defaultN ? { n: initialFraming.defaultN } : {}),
  });
  const [framingId, setFramingId] = useState<PanelFraming['id']>(initialFraming.id);
  const [hovered, setHovered] = useState<number | null>(null);
  // The round-anatomy ribbon is clickable: selecting a step explains that one
  // phase of the round, in order, without leaving the live view.
  const [anatomyStep, setAnatomyStep] = useState(STEP_LABELS.length - 1);

  const framing = PANEL_FRAMINGS.find((f) => f.id === framingId) ?? DEFAULT_FRAMING;

  const selectFraming = (f: PanelFraming) => {
    setFramingId(f.id);
    sim.setConfig({ dgpId: f.dgpId });
    sim.restart();
  };

  const trace = sim.result.traces[sim.round];
  const totalWager = trace ? trace.effectiveWager.reduce((s, v) => s + v, 0) : 0;
  const totalDeposit = trace ? trace.deposits.reduce((s, v) => s + v, 0) : 0;
  const residual = trace ? budgetBalanceResidual(trace) : 0;

  // Contribution demo. Run the SAME synthetic panel twice on the same seed:
  // once with the skill layer on (full mechanism) and once with it off
  // (uniform weights, the plain wagering baseline). The mean aggregate-CRPS
  // gap is the contribution this project adds. Both runs use the real
  // simulator; nothing is hand-set.
  const contribution = useMemo(() => {
    const common = {
      dgpId: framing.dgpId,
      behaviourPreset: 'baseline' as const,
      rounds: sim.config.rounds,
      seed: sim.config.seed,
      n: sim.config.n,
    };
    const on = runPipeline({ ...common, weighting: 'full' });
    const off = runPipeline({ ...common, weighting: 'uniform' });
    const gapPct = off.summary.meanError > 0
      ? ((on.summary.meanError - off.summary.meanError) / off.summary.meanError) * 100
      : 0;
    return { onErr: on.summary.meanError, offErr: off.summary.meanError, gapPct };
  }, [framing.dgpId, sim.config.rounds, sim.config.seed, sim.config.n]);

  // Gentle hover readout: exact q10 / median / q90 and weight for one row.
  const hoverRow = hovered != null && trace ? {
    label: forecasterLabel(hovered),
    colour: forecasterColour(hovered),
    q10: trace.qReports[hovered]?.[0],
    med: trace.qReports[hovered]?.[4],
    q90: trace.qReports[hovered]?.[8],
    w: trace.weights[hovered] ?? 0,
  } : null;

  return (
    <PlatformLayout>
      <SectionHeading
        as={1}
        eyebrow="Watch the market"
        title="One panel, many rounds: watch the aggregate form and the pool clear"
        subtitle="Start paused on round 1, then press play. Each round the forecasters post a fan and a deposit, the skill gate sets each effective wager, the reports combine into the wager-weighted aggregate, the outcome lands, and the pool redistributes by relative score. The pool clears with no sponsor."
        companion={<ThesisRef viewKey="platform/market" />}
      />

      <HowToRead
        id="market-floor"
        points={[
          'The fan shows the aggregate forecast and its uncertainty for the chosen panel.',
          'Steering the market re-weights the forecasters and the fan responds live.',
          'This is a synthetic illustration. Numbers here are not a real-data claim.',
        ]}
      />

      {/* Domain selector (P2 + domain_picker). The button leads with the domain
          name so the choice reads as a domain switch, and carries the panel type
          beneath as a caption so the statistical framing stays visible. Switches
          the synthetic regime and the evidence link; the maths and every shown
          value stay synthetic. */}
      <p className="eyebrow" style={controlEyebrow}>Choose a domain</p>
      <div style={{ display: 'flex', gap: SPACE[3], flexWrap: 'wrap', marginTop: SPACE[2], alignItems: 'center' }}>
        {PANEL_FRAMINGS.map((f) => (
          <Button
            key={f.id}
            size="md"
            variant={framingId === f.id ? 'primary' : 'secondary'}
            onClick={() => selectFraming(f)}
            data-testid={`framing-${f.id}`}
            aria-pressed={framingId === f.id}
          >
            <span style={domainSwitchLabel}>
              <span style={domainSwitchLead}>{f.domainLabel}</span>
              <span style={domainSwitchSub}>{f.label}</span>
            </span>
          </Button>
        ))}
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)' }}>
          {framing.note}
        </span>
      </div>

      <div style={{ marginTop: SPACE[6] }}>
        <TransportControls
          round={sim.round}
          totalRounds={sim.totalRounds}
          isPlaying={sim.isPlaying}
          onToggle={sim.toggle}
          onStep={sim.step}
          onScrub={sim.setRound}
          onRestart={sim.restart}
          speedMs={sim.speedMs}
          onSpeed={sim.setSpeed}
        />
      </div>

      <div style={{ marginTop: SPACE[4] }}>
        <MarketLegend />
      </div>

      {trace && (
        <Card elevation="raised" padding="roomy" style={{ marginTop: SPACE[4] }}>
          <ChartScroller label="Market floor chart">
            <MarketFloor trace={trace} n={sim.config.n} hovered={hovered} onHover={setHovered} />
          </ChartScroller>
          <div
            aria-live="polite"
            style={{
              minHeight: 24,
              marginTop: SPACE[2],
              fontFamily: 'var(--font-sans)',
              fontSize: TYPE.caption.size,
              color: 'var(--ink-soft)',
            }}
          >
            {hoverRow ? (
              <span>
                <span style={{ color: hoverRow.colour, fontWeight: 700 }}>{hoverRow.label}</span>
                {' '}forecasts q10 {hoverRow.q10?.toFixed(2)}, median {hoverRow.med?.toFixed(2)}, q90 {hoverRow.q90?.toFixed(2)}, and holds weight {(hoverRow.w * 100).toFixed(1)}% in the aggregate.
              </span>
            ) : (
              <span>Point at any row to read that forecaster&apos;s exact q10, median, q90 and weight. The shaded vertical band is the aggregate&apos;s q10 to q90 range.</span>
            )}
          </div>
        </Card>
      )}

      {/* Round anatomy: the seven steps each round runs, in the draft's order.
          Clickable, so a viewer can step through and read each phase. */}
      <Card padding="default" style={{ marginTop: SPACE[5] }}>
        <h2 style={panelHeading}>What happens each round, in order</h2>
        <StepRibbon active={anatomyStep} onSelect={setAnatomyStep} />
        <p aria-live="polite" data-testid="anatomy-caption" style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-soft)', margin: `${SPACE[3]}px 0 0` }}>
          <span style={{ fontWeight: 700, color: SEM[STEP_CONCEPTS[anatomyStep]].main }}>{STEP_LABELS[anatomyStep]}.</span>{' '}
          {STEP_CAPTIONS[anatomyStep]}
        </p>
      </Card>

      <SectionHeading level={3} eyebrow="At a glance" title="This round at a glance" className="mt-12" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: SPACE[4],
          marginTop: SPACE[4],
        }}
      >
        <StatTile label="Deposits in" value={totalDeposit.toFixed(2)} accent="deposit" sublabel="&Sigma; b_i" />
        <StatTile label="Effective wager" value={totalWager.toFixed(2)} accent="wager" sublabel="&Sigma; m_i = M" />
        <StatTile label="Effective count N_eff" value={trace ? trace.nEff.toFixed(2) : '0'} accent="skill" sublabel="1 / &Sigma; w_i&sup2;" />
        <StatTile label="Top weight share" value={trace ? `${(trace.topShare * 100).toFixed(1)}` : '0'} unit="%" accent="aggregate" sublabel={`cap &omega;_max = 25%`} />
        <StatTile label="Budget residual" value={residual.toExponential(1)} accent="payoff" sublabel="&Sigma;&pi; &minus; &Sigma;m &asymp; 0" />
      </div>

      {/* The contribution, made unmistakable: same panel, skill layer off vs on. */}
      <SectionHeading level={3} eyebrow="What this project adds" title="The skill layer: re-weight deposits by past forecast quality" className="mt-12" />
      <Card elevation="raised" padding="roomy" style={{ marginTop: SPACE[5] }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.body.size, color: 'var(--ink-soft)', margin: `0 0 ${SPACE[5]}px`, maxWidth: '64ch' }}>
          A plain wagering mechanism weights every forecaster by their deposit alone. This project adds an online skill layer that re-weights deposits by each forecaster&apos;s past forecast quality before each round, while the pool still clears itself and honest reporting still pays. On a panel that differs in quality the aggregate sharpens; on a panel where everyone is alike it stays near the plain baseline, by design.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: SPACE[4] }}>
          <StatTile
            label="Skill layer off (uniform)"
            value={contribution.offErr.toFixed(4)}
            accent="outcome"
            sublabel="mean aggregate CRPS, lower is better"
          />
          <StatTile
            label="Skill layer on (full mechanism)"
            value={contribution.onErr.toFixed(4)}
            accent="aggregate"
            sublabel="mean aggregate CRPS, lower is better"
            data-testid="contribution-on"
          />
          <StatTile
            label="Mechanism vs uniform"
            value={`${contribution.gapPct >= 0 ? '+' : ''}${contribution.gapPct.toFixed(1)}`}
            unit="%"
            accent="aggregate"
            delta={{ value: contribution.gapPct < 0 ? 'sharper' : 'no gain', direction: contribution.gapPct < 0 ? 'down' : 'flat' }}
            sublabel="aggregate CRPS gap on this panel"
          />
        </div>
      </Card>

      <SectionHeading level={3} title="Steer the market" subtitle="Change the panel, the skill gate, or inject an event and watch the panel respond." className="mt-12" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: SPACE[5],
          marginTop: SPACE[6],
        }}
      >
        <Card padding="default">
          <h3 style={panelHeading}>Panel size</h3>
          <label style={labelStyle}>Forecasters: {sim.config.n}</label>
          <input type="range" min={3} max={12} step={1} value={sim.config.n} onChange={(e) => sim.setConfig({ n: parseInt(e.target.value, 10) })} aria-label="Number of forecasters" style={{ width: '100%' }} data-testid="panel-size" />
          <label style={{ ...labelStyle, marginTop: SPACE[4] }}>Rounds: {sim.config.rounds}</label>
          <input type="range" min={20} max={200} step={10} value={sim.config.rounds} onChange={(e) => sim.setConfig({ rounds: parseInt(e.target.value, 10) })} aria-label="Number of rounds" style={{ width: '100%' }} />
        </Card>

        <Card padding="default">
          <h3 style={panelHeading}>Skill gate</h3>
          <label style={labelStyle}>Gate floor &lambda;: {sim.config.lam.toFixed(2)}</label>
          <input type="range" min={0} max={1} step={0.05} value={sim.config.lam} onChange={(e) => sim.setConfig({ lam: parseFloat(e.target.value) })} aria-label="Gate floor lambda" style={{ width: '100%' }} />
          <label style={{ ...labelStyle, marginTop: SPACE[4] }}>Gate exponent &eta;: {sim.config.eta}</label>
          <input type="range" min={1} max={4} step={1} value={sim.config.eta} onChange={(e) => sim.setConfig({ eta: parseInt(e.target.value, 10) })} aria-label="Gate exponent eta" style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap', marginTop: SPACE[4] }}>
            {INFLUENCE.map((r) => (
              <Button key={r.id} size="sm" variant={sim.config.influenceRule === r.id ? 'primary' : 'secondary'} onClick={() => sim.setConfig({ influenceRule: r.id })}>
                {r.label}
              </Button>
            ))}
          </div>
        </Card>

        <Card padding="default">
          <h3 style={panelHeading}>Inject an event</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
            {EVENTS.map((ev) => (
              <Button key={ev.id} size="sm" variant={sim.config.event === ev.id ? 'primary' : 'ghost'} onClick={() => sim.setConfig({ event: ev.id })} style={{ justifyContent: 'flex-start' }}>
                {ev.label}
              </Button>
            ))}
          </div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)', margin: `${SPACE[3]}px 0 0` }}>
            {EVENTS.find((e) => e.id === sim.config.event)?.note}
          </p>
        </Card>
      </div>

      <div style={{ marginTop: SPACE[6], display: 'flex', gap: SPACE[3], alignItems: 'center', flexWrap: 'wrap' }}>
        <Tag tone="caution" size="sm">Synthetic sandbox - not the real-data headline</Tag>
        <a href={framing.evidenceHref} style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--imperial)' }}>
          {framing.evidenceText}
        </a>
      </div>

      <StoryNav current={2} />
    </PlatformLayout>
  );
}

const panelHeading: React.CSSProperties = {
  fontFamily: 'var(--font-serif)',
  fontSize: TYPE.h3.size,
  fontWeight: 600,
  color: 'var(--ink)',
  margin: `0 0 ${SPACE[4]}px`,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-sans)',
  fontSize: TYPE.label.size,
  fontWeight: 600,
  color: 'var(--ink-soft)',
  marginBottom: SPACE[2],
};

const domainSwitchLabel: React.CSSProperties = {
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  lineHeight: 1.15,
};

const domainSwitchLead: React.CSSProperties = {
  fontWeight: 700,
};

const domainSwitchSub: React.CSSProperties = {
  fontSize: TYPE.caption.size,
  fontWeight: 500,
  opacity: 0.85,
};

const controlEyebrow: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: TYPE.label.size,
  fontWeight: 600,
  color: 'var(--teal-deep)',
  margin: `${SPACE[6]}px 0 0`,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
};
