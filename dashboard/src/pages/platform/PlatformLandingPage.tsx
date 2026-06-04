import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import PlatformLayout from '@/components/platform/PlatformLayout';
import { Button, Card, StatTile, SectionHeading, Tag } from '@/components/platform/ui';
import QuantileFan from '@/components/platform/viz/QuantileFan';
import ChartScroller from '@/components/platform/viz/ChartScroller';
import StepRibbon, { STEP_CAPTIONS, STEP_CONCEPTS, STEP_LABELS } from '@/components/platform/viz/StepRibbon';
import StoryNav from '@/components/platform/StoryNav';
import ClientChooser from '@/components/platform/ClientChooser';
import { useMarketSimulation } from '@/components/platform/hooks/useMarketSimulation';
import { StartTourButton } from '@/components/platform/GuidedTour';
import ThesisRef from '@/components/dashboard/ThesisRef';
import { TYPE, SPACE, DURATION } from '@/components/platform/designTokens';
import { SEM } from '@/lib/tokens';
import { TAUS } from '@/lib/coreMechanism/dgpSimulator';

/**
 * Platform landing / hero. One striking screen: the marketplace idea, a live
 * aggregate fan drawn from a real simulated round, and a call to action into
 * the "be a forecaster" flow. Animated but calm; reduce-motion safe.
 *
 * Every number traces to a real trace value from a single simulated round.
 */
export default function PlatformLandingPage() {
  const reduce = useReducedMotion();
  const { result } = useMarketSimulation({ rounds: 40 });
  // Clickable round anatomy: selecting a step reveals that phase's note, so a
  // first-time visitor can preview a round step by step before trying one.
  const [anatomyStep, setAnatomyStep] = useState(STEP_LABELS.length - 1);

  // Use a settled mid-series round so skill has separated and the aggregate is
  // representative. All values below are read from this one trace.
  const trace = useMemo(() => result.traces[Math.min(24, result.traces.length - 1)], [result.traces]);

  const totalWager = trace ? trace.effectiveWager.reduce((s, v) => s + v, 0) : 0;
  const totalPayoff = trace ? trace.skillPayoff.reduce((s, v) => s + v, 0) : 0;
  const residual = totalPayoff - totalWager;

  const fadeUp = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? { duration: 0 } : { delay, duration: DURATION.deliberate / 1000 },
  });

  return (
    <PlatformLayout>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)',
          gap: SPACE[10],
          alignItems: 'center',
        }}
        className="platform-hero-grid"
      >
        <motion.div {...fadeUp(0)}>
          <p
            className="eyebrow"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: TYPE.label.size,
              fontWeight: TYPE.label.weight,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--teal-deep)',
              margin: 0,
            }}
          >
            A self-financed prediction market
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: TYPE.display.size,
              lineHeight: TYPE.display.lineHeight,
              fontWeight: TYPE.display.weight,
              color: 'var(--ink)',
              letterSpacing: '-0.01em',
              margin: `${SPACE[4]}px 0`,
            }}
          >
            Pay for forecast quality, not for data.
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: TYPE.lead.size,
              lineHeight: TYPE.lead.lineHeight,
              color: 'var(--ink-soft)',
              maxWidth: '60ch',
              margin: 0,
            }}
          >
            Forecasters post a probabilistic forecast and a deposit. A skill gate
            rescales each deposit into an effective wager; reports combine into a
            wager-weighted aggregate. Once the outcome lands, the pool
            redistributes by relative forecast quality and a skill memory lifts
            the forecasters who have been right before. The pool pays for itself.
          </p>
          <ThesisRef viewKey="platform" style={{ marginTop: SPACE[4] }} />
          <div style={{ display: 'flex', gap: SPACE[3], marginTop: SPACE[6], flexWrap: 'wrap' }}>
            <Button as="a" href="#/platform/forecast" size="lg">
              Try it: be a forecaster
            </Button>
            <Button as="a" href="#/platform/market" size="lg" variant="secondary">
              Watch the market
            </Button>
            <StartTourButton size="lg" variant="ghost" />
          </div>
        </motion.div>

        <motion.div {...fadeUp(0.12)}>
          <Card elevation="raised" padding="roomy">
            <div style={{ marginBottom: SPACE[3] }}>
              <Tag tone="info" size="sm">Live simulation</Tag>
            </div>
            {trace && (
              <ChartScroller label="Live aggregate quantile fan">
                <QuantileFan
                  quantiles={trace.r_hat_q}
                  taus={TAUS}
                  outcome={trace.y}
                  title="A wager-weighted aggregate, forming live"
                  ariaLabel="Live aggregate quantile fan from a simulated round"
                  axisLabel="normalised outcome"
                  data-testid="landing-aggregate-fan"
                />
              </ChartScroller>
            )}
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)', margin: `${SPACE[3]}px 0 0` }}>
              The shaded bands are the 80 / 60 / 40 / 20% coverage intervals of
              the aggregate q&#770;(&tau;); the dashed line is the realised outcome y.
            </p>
          </Card>
        </motion.div>
      </section>

      <div style={{ marginTop: SPACE[16] }}>
        <ClientChooser />
      </div>

      <motion.div {...fadeUp(0.2)} style={{ marginTop: SPACE[16] }}>
        <SectionHeading
          eyebrow="One round, seven moves"
          title="How a round settles"
          subtitle="Submit a report and a deposit. The skill gate sets the effective wager, reports aggregate, the outcome scores them, and the pool settles. The skill memory then updates for the next round."
        />
        <div style={{ marginTop: SPACE[6] }}>
          <StepRibbon active={anatomyStep} onSelect={setAnatomyStep} />
          <p aria-live="polite" data-testid="landing-anatomy-caption" style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-soft)', margin: `${SPACE[3]}px 0 0` }}>
            <span style={{ fontWeight: 700, color: SEM[STEP_CONCEPTS[anatomyStep]].main }}>{STEP_LABELS[anatomyStep]}.</span>{' '}
            {STEP_CAPTIONS[anatomyStep]}
          </p>
        </div>
      </motion.div>

      <motion.div {...fadeUp(0.28)} style={{ marginTop: SPACE[12] }}>
        <SectionHeading level={3} eyebrow="At a glance" title="This round at a glance" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: SPACE[5],
            marginTop: SPACE[5],
          }}
        >
          <StatTile
            label="Forecasters this round"
            value={trace ? trace.activeCount : 0}
            accent="skill"
            sublabel="active participants in the panel"
          />
          <StatTile
            label="Effective wager pooled"
            value={totalWager.toFixed(2)}
            accent="wager"
            sublabel="&Sigma; m_i, the gated deposits"
          />
          <StatTile
            label="Budget-balance residual"
            value={residual.toExponential(1)}
            accent="payoff"
            sublabel="&Sigma;&pi; &minus; &Sigma;m &asymp; 0, self-financed"
          />
        </div>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)', marginTop: SPACE[4] }}>
          Every figure here is read from one simulated round of the synthetic
          sandbox. It is not the project's real-data result. See the evidence pages
          for the verified Elia numbers.
        </p>
      </motion.div>

      <style>{`
        @media (max-width: 1024px) {
          /* minmax(0, 1fr): the aggregate-fan card's min-content would
             otherwise force the single column wider than a phone viewport. */
          .platform-hero-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>

      <StoryNav current={0} />
    </PlatformLayout>
  );
}
