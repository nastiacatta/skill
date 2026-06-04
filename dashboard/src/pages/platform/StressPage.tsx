import { useMemo, useState } from 'react';
import PlatformLayout from '@/components/platform/PlatformLayout';
import { Card, StatTile, SectionHeading, Tag, Button } from '@/components/platform/ui';
import MarketFloor from '@/components/platform/market/MarketFloor';
import MarketLegend from '@/components/platform/market/MarketLegend';
import TransportControls from '@/components/platform/market/TransportControls';
import TrajectoryChart from '@/components/platform/viz/TrajectoryChart';
import ChartScroller from '@/components/platform/viz/ChartScroller';
import { useAttackSimulation } from '@/components/platform/hooks/useAttackSimulation';
import { ATTACKS } from '@/lib/platform/attackCatalogue';
import ThesisRef from '@/components/dashboard/ThesisRef';
import HowToRead from '@/components/dashboard/HowToRead';
import { TYPE, SPACE } from '@/components/platform/designTokens';
import { SEM } from '@/lib/tokens';

/**
 * Attacks and manipulations: a visitor-facing, story-led stress view.
 *
 * The visitor picks one attack from a curated subset of the draft's adversary
 * catalogue (writing/80_robustness.md, canonical names), then watches the SAME
 * synthetic panel run with and without the attack, side by side, over rounds.
 * Both panels come from the real simulator (useAttackSimulation runs runPipeline
 * twice) and are scrubbed in lockstep, so only the attack differs between them
 * (small-multiple comparison, representation_notes §6).
 *
 * The maths is kept out of the default view. Each attack is explained in plain
 * English: what the attacker tries, what the mechanism does, and the honest
 * limit (where the draft says the surface is open or only partially absorbed).
 * The per-round signal (profit-with-a-zero-line, weight-on-[0,1], or wager
 * conservation) follows the attack: profit above the zero line is leakage,
 * weight shrinking shows the skill gate at work, conservation shows the sybil
 * split not amplifying the stake. The dense research tabs live on /robustness
 * and this view links there.
 */
export default function StressPage() {
  const sim = useAttackSimulation({ attackId: ATTACKS[0].id, rounds: 120 });
  const [showMaths, setShowMaths] = useState(false);
  const attack = sim.attack;

  const traceWith = sim.withAttack.traces[sim.round];
  const traceWithout = sim.withoutAttack.traces[sim.round];

  // Per-round caption phase. Paused start, a readable engage phase, a settled
  // tail; the reputation-reset attack grooms first, then exploits after the
  // build window, so its phases are named for that.
  const phase = useMemo(() => {
    const r = sim.round + 1;
    const total = sim.totalRounds;
    if (attack.id === 'reputation_reset') {
      if (r <= 100) return 'Grooming: the attacker plays honestly to build a skill estimate.';
      return 'Exploit: the groomed identity degrades, and the skill gate pulls its weight back down.';
    }
    if (r <= 3) return 'Warming up: skill estimates start from the newcomer prior, weights near even.';
    if (r >= total - 3) return 'Settled: the panel has reached its steady state with the attack engaged.';
    return attack.engageCaption;
  }, [attack, sim.round, sim.totalRounds]);

  // Signal series for the chart, chosen per attack.
  const chart = useMemo(() => {
    const upto = (arr: number[]) => arr.slice(0, sim.round + 1);
    if (attack.signal === 'weight') {
      return {
        title: 'Attacker weight share over rounds',
        yLabel: 'weight share',
        yDomain: [0, 1] as [number, number],
        reference: undefined,
        series: [
          { label: 'with attack', data: upto(sim.series.attackerWeight), colour: SEM.outcome.main },
          { label: 'no attack', data: upto(sim.series.baselineWeight), colour: SEM.aggregate.main, dash: '5 4' },
        ],
        caption:
          'The strategic reporter scores poorly against the realised outcome, its skill estimate falls, and the skill gate shrinks its weight. Lower weight means less pull on the aggregate.',
      };
    }
    if (attack.signal === 'conservation') {
      return {
        title: 'Combined stake of the clone pair over rounds',
        yLabel: 'combined amount',
        yDomain: undefined,
        reference: undefined,
        series: [
          { label: 'combined effective wager', data: upto(sim.series.combinedWager), colour: SEM.wager.main },
          { label: 'combined deposit', data: upto(sim.series.combinedDeposit), colour: SEM.deposit.main, dash: '5 4' },
        ],
        caption:
          'The two clones each post half a deposit, so the combined stake stays conserved as the identity splits. Splitting earns no more than a single identity would.',
      };
    }
    // profit: cumulative attacker profit with an explicit zero-profit baseline.
    const withData = upto(sim.series.attackerProfit);
    const baseData = upto(sim.series.baselineProfit);
    const all = [...withData, ...baseData, 0];
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    const pad = (hi - lo || 1) * 0.12;
    return {
      title: 'Cumulative attacker profit over rounds',
      yLabel: 'profit',
      yDomain: [Math.min(lo - pad, 0), Math.max(hi + pad, 0)] as [number, number],
      reference: { value: 0, label: 'no leakage' },
      series: [
        { label: 'with attack', data: withData, colour: SEM.outcome.main },
        { label: 'no attack', data: baseData, colour: SEM.aggregate.main, dash: '5 4' },
      ],
      caption:
        'Higher attacker profit is worse for the mechanism, and the gap between the two lines is the difference the attack makes. This short synthetic run is illustrative, so the absolute level can sit either side of the zero line. The committed result is the per-1,000-round figure quoted above.',
    };
  }, [attack, sim.series, sim.round]);

  const surfaceTone =
    attack.surface === 'closed' ? 'good' : attack.surface === 'open' ? 'bad' : 'caution';
  const surfaceLabel =
    attack.surface === 'closed'
      ? 'Closed surface'
      : attack.surface === 'open'
      ? 'Open Lambert surface'
      : 'Narrow case closed, diversified case open';

  return (
    <PlatformLayout>
      <SectionHeading
        as={1}
        eyebrow="Attacks and manipulations"
        title="Pick an attack, watch the same panel run with and without it"
        subtitle="The mechanism is stress-tested against a catalogue of adversaries. Pick one, press play, and watch it run against the real mechanism over rounds. The left panel has the attack engaged, the right panel is the same panel with no attack, scrubbed together so only the attack differs. Each attack says in plain English what it tries, what the mechanism does, and where its limits are."
        companion={<ThesisRef viewKey="platform/stress" />}
      />

      {/* Attack picker: the curated subset, canonical names. */}
      <div
        role="group"
        aria-label="Choose an attack"
        style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap', marginTop: SPACE[6] }}
      >
        {ATTACKS.map((a) => (
          <Button
            key={a.id}
            size="md"
            variant={attack.id === a.id ? 'primary' : 'secondary'}
            onClick={() => sim.setConfig({ attackId: a.id })}
            data-testid={`attack-${a.id}`}
          >
            {a.name}
          </Button>
        ))}
      </div>

      {/* Plain-English framing: tries / response / limit + the draft's result. */}
      <Card elevation="raised" padding="roomy" style={{ marginTop: SPACE[5] }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], flexWrap: 'wrap', marginBottom: SPACE[4] }}>
          <h2 style={{ ...panelHeading, margin: 0 }}>{attack.name}</h2>
          <Tag tone={surfaceTone} size="sm">{surfaceLabel}</Tag>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)' }}>
            {attack.family}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: SPACE[5] }}>
          <Field step={1} label="What it tries" body={attack.tries} />
          <Field step={2} label="What the mechanism does" body={attack.response} />
          <Field step={3} label="The honest limit" body={attack.limit} tone="limit" />
        </div>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: TYPE.caption.size,
            color: 'var(--ink-soft)',
            margin: `${SPACE[5]}px 0 0`,
            paddingTop: SPACE[4],
            borderTop: '1px solid var(--border)',
            maxWidth: '80ch',
          }}
        >
          <strong style={{ fontWeight: 700 }}>What the draft reports.</strong> {attack.draftResult}
        </p>
      </Card>

      {/* Transport: paused start, readable pacing, step + scrub, shared by both panels. */}
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

      {/* Per-round caption. */}
      <div
        aria-live="polite"
        style={{
          minHeight: 24,
          marginTop: SPACE[4],
          fontFamily: 'var(--font-sans)',
          fontSize: TYPE.body.size,
          color: 'var(--ink-soft)',
        }}
        data-testid="attack-phase-caption"
      >
        {phase}
      </div>

      <div style={{ marginTop: SPACE[4] }}>
        <MarketLegend />
      </div>

      <HowToRead
        id="stress-floor"
        points={[
          'The setup above defines the attack: who tries it, how the mechanism responds, and the limit on the damage.',
          'The two charts show the worst outcome an attacker can force as the deposit floor rises.',
          'A flatter or lower curve means the floor contains the attack.',
        ]}
      />

      {/* Side-by-side floors: same axes, same colours, only the attack differs. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))',
          gap: SPACE[5],
          marginTop: SPACE[4],
        }}
      >
        <Card elevation="raised" padding="default">
          <FloorTitle tone="bad" label="With the attack" />
          {traceWith && (
            <ChartScroller label="Market floor with the attack">
              <MarketFloor trace={traceWith} n={sim.config.n} />
            </ChartScroller>
          )}
        </Card>
        <Card elevation="raised" padding="default">
          <FloorTitle tone="neutral" label="No attack (same panel)" />
          {traceWithout && (
            <ChartScroller label="Market floor with no attack">
              <MarketFloor trace={traceWithout} n={sim.config.n} />
            </ChartScroller>
          )}
        </Card>
      </div>

      {/* The per-round signal for this attack, with its honest baseline. */}
      <SectionHeading
        level={3}
        title={chart.title}
        subtitle={chart.caption}
        className="mt-12"
      />
      <Card padding="roomy" style={{ marginTop: SPACE[5] }}>
        <ChartScroller label={chart.title}>
          <TrajectoryChart
            series={chart.series}
            ariaLabel={chart.title}
            yLabel={chart.yLabel}
            yDomain={chart.yDomain}
            reference={chart.reference}
            data-testid="attack-signal-chart"
          />
        </ChartScroller>
      </Card>

      {/* Conservation readout for the sybil case: combined wager at this round. */}
      {attack.signal === 'conservation' && traceWith && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: SPACE[4],
            marginTop: SPACE[5],
          }}
        >
          <StatTile
            label="Clone pair: combined deposit"
            value={sim.series.combinedDeposit[sim.round]?.toFixed(2) ?? '0'}
            accent="deposit"
            sublabel="two clones, each posting half"
            data-testid="sybil-combined-deposit"
          />
          <StatTile
            label="Clone pair: combined effective wager"
            value={sim.series.combinedWager[sim.round]?.toFixed(2) ?? '0'}
            accent="wager"
            sublabel="conserved as the identity splits"
          />
        </div>
      )}

      {/* Steer the attack: panel + gate floor. */}
      <SectionHeading level={3} title="Steer the attack" subtitle="Change the panel or the skill gate floor and watch both panels respond." className="mt-12" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: SPACE[5], marginTop: SPACE[6] }}>
        <Card padding="default">
          <h3 style={panelHeading}>Panel</h3>
          <label style={labelStyle}>Forecasters: {sim.config.n}</label>
          <input type="range" min={4} max={10} step={1} value={sim.config.n} onChange={(e) => sim.setConfig({ n: parseInt(e.target.value, 10) })} aria-label="Number of forecasters" style={{ width: '100%' }} data-testid="attack-panel-size" />
          <div style={{ display: 'flex', gap: SPACE[2], flexWrap: 'wrap', marginTop: SPACE[4] }}>
            <Button size="sm" variant={sim.config.dgpId === 'latent_fixed' ? 'primary' : 'secondary'} onClick={() => sim.setConfig({ dgpId: 'latent_fixed' })}>
              Heterogeneous panel
            </Button>
            <Button size="sm" variant={sim.config.dgpId === 'baseline' ? 'primary' : 'secondary'} onClick={() => sim.setConfig({ dgpId: 'baseline' })}>
              Near-homogeneous panel
            </Button>
          </div>
        </Card>
        <Card padding="default">
          <h3 style={panelHeading}>Skill gate floor &lambda;</h3>
          <label style={labelStyle}>Gate floor &lambda;: {sim.config.lam.toFixed(2)}</label>
          <input type="range" min={0} max={1} step={0.05} value={sim.config.lam} onChange={(e) => sim.setConfig({ lam: parseFloat(e.target.value) })} aria-label="Gate floor lambda" style={{ width: '100%' }} data-testid="attack-gate-floor" />
          {attack.id === 'arbitrage_seeker' && (
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)', margin: `${SPACE[3]}px 0 0` }}>
              The draft reports arbitrage profit rising with the gate floor, not falling. Raising &lambda; widens the opening.
            </p>
          )}
        </Card>
      </div>

      {/* Optional maths affordance, off by default. */}
      <div style={{ marginTop: SPACE[6] }}>
        <Button size="sm" variant="ghost" onClick={() => setShowMaths((s) => !s)} data-testid="show-maths-toggle">
          {showMaths ? 'Hide the maths' : 'Show the maths'}
        </Button>
        {showMaths && (
          <Card padding="default" style={{ marginTop: SPACE[3] }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: TYPE.caption.size, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.7 }}>
              Effective wager m_i = b_i &middot; g(&sigma;_i), gate g(&sigma;) = &lambda; + (1 &minus; &lambda;) &sigma;^&eta;.<br />
              Weight w_i = m_i / &Sigma;_j m_j. Profit &pi;_i &minus; m_i = m_i (s_i &minus; s&#772;), with s&#772; the wager-weighted mean score.<br />
              Budget balance &Sigma;_i &pi;_i = &Sigma;_i m_i holds every round, so the pool clears with no sponsor.
            </p>
          </Card>
        )}
      </div>

      {/* Honest framing + link to the dense research catalogue. */}
      <div style={{ marginTop: SPACE[6], display: 'flex', gap: SPACE[3], alignItems: 'center', flexWrap: 'wrap' }}>
        <Tag tone="caution" size="sm">Synthetic sandbox - not the real-data headline</Tag>
        <a href="#/robustness" style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--imperial)' }}>
          See the full adversary catalogue and per-class results in the robustness research
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

function Field({ step, label, body, tone }: { step: number; label: string; body: string; tone?: 'limit' }) {
  return (
    <div>
      <p
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[2],
          fontFamily: 'var(--font-sans)',
          fontSize: TYPE.label.size,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: tone === 'limit' ? 'var(--crimson)' : 'var(--ink-soft)',
          margin: `0 0 ${SPACE[2]}px`,
        }}
      >
        <Tag tone={tone === 'limit' ? 'caution' : 'neutral'} size="sm">{step}</Tag>
        {label}
      </p>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.body.size, lineHeight: 1.55, color: 'var(--ink)', margin: 0 }}>
        {body}
      </p>
    </div>
  );
}

function FloorTitle({ label, tone }: { label: string; tone: 'bad' | 'neutral' }) {
  return (
    <div style={{ marginBottom: SPACE[3] }}>
      <Tag tone={tone} size="sm">{label}</Tag>
    </div>
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
