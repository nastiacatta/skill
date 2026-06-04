import { useCallback, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import PlatformLayout from '@/components/platform/PlatformLayout';
import { Button, Card, StatTile, SectionHeading, Tag } from '@/components/platform/ui';
import ThesisRef from '@/components/dashboard/ThesisRef';
import QuantileFan from '@/components/platform/viz/QuantileFan';
import ChartScroller from '@/components/platform/viz/ChartScroller';
import StepRibbon, { STEP_CONCEPTS } from '@/components/platform/viz/StepRibbon';
import StoryNav from '@/components/platform/StoryNav';
import {
  useForecasterGame,
  VISITOR_INDEX,
  type SettledRound,
} from '@/components/platform/hooks/useForecasterGame';
import { fanFromMedianSpread } from '@/components/platform/viz/fanMaths';
import { skillGate } from '@/components/platform/derivedMetrics';
import { TYPE, SPACE, DURATION } from '@/components/platform/designTokens';
import { TAUS } from '@/lib/coreMechanism/dgpSimulator';
import { SEM } from '@/lib/tokens';
import { forecasterColour } from '@/components/platform/forecasterIdentity';

/**
 * "Be a forecaster": the visitor authors a real quantile fan, sets a deposit,
 * and settles one round against a realised outcome. The fan is scored, gated,
 * aggregated and settled by `runComposableRound` (via useForecasterGame), so
 * every number shown is a real trace field for the visitor's row (slot 0).
 */
/** Phase titles mirror the StepRibbon labels for the second-person flow copy. */
const STEP_TITLES = ['Submit', 'Deposit', 'Gate', 'Aggregate', 'Outcome', 'Score', 'Settle'] as const;

/** Second-person caption per phase, so stepping the ribbon narrates the round. */
const PHASE_NOTES = [
  'Compose your quantile fan above, or snap it to your honest belief.',
  'Risk a fraction of your wealth as the deposit b.',
  'Your skill gate g(σ) rescales the deposit into an effective wager m.',
  'Your report joins the panel and combines into the wager-weighted aggregate.',
  'The realised outcome y lands and is drawn on your fan.',
  'Your fan is scored against the outcome by the pinball CRPS.',
  'The pool settles by relative score and your skill updates for next round.',
] as const;

export default function ForecastFlowPage() {
  const reduce = useReducedMotion();
  const game = useForecasterGame();

  const [fan, setFan] = useState<number[]>(() => fanFromMedianSpread(0.5, 0.35));
  const [riskPct, setRiskPct] = useState(0.18);
  const [settled, setSettled] = useState<SettledRound | null>(null);
  // The seven round phases (0 Submit ... 6 Settle). The viewer can click any
  // step to walk one round in any order; the same submitted fan and deposit
  // drive every phase, so the visualisation only ever changes what it reveals.
  const [phase, setPhase] = useState(0);

  // Phases up to and including the skill gate are previewable before settling
  // (deposit, gate, effective wager are all live previews). The aggregate,
  // realised outcome, score and settlement need the computed round, so
  // selecting one of those settles the round first.
  const PREVIEWABLE_PHASES = 2;

  const onSettle = useCallback((target = 6) => {
    const result = game.settle(fan, riskPct);
    setSettled(result);
    setPhase(target);
  }, [fan, game, riskPct]);

  const onSelectPhase = useCallback((i: number) => {
    if (!settled && i > PREVIEWABLE_PHASES) {
      onSettle(i);
      return;
    }
    setPhase(i);
  }, [settled, onSettle]);

  const onNext = useCallback(() => {
    setSettled(null);
    setPhase(0);
    setFan(fanFromMedianSpread(0.5, 0.35));
  }, []);

  const onBeHonest = useCallback(() => {
    setFan(game.honestTarget.slice());
  }, [game.honestTarget]);

  // The realised outcome y only belongs on the fan once the viewer has stepped
  // to the Outcome phase (4) or beyond, so stepping there does something
  // visible: the dashed outcome marker appears.
  const showOutcome = Boolean(settled) && phase >= 4;

  // Live preview of the visitor's effective wager before settling:
  // m = b · g(σ), b = wealth · riskFraction (wealth_fraction policy).
  const previewDeposit = game.visitorWealth * riskPct;
  const gate = skillGate(game.visitorSkill, game.config.lam, game.config.eta);
  const previewWager = previewDeposit * gate;

  const t = settled?.trace;
  const vi = VISITOR_INDEX;
  const visitorColour = forecasterColour(vi);

  const fadeUp = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? { duration: 0 } : { delay, duration: DURATION.base / 1000 },
  });

  // Derived settled figures (all from the trace, visitor row).
  const meanScore = useMemo(() => {
    if (!t) return 0;
    const totalM = t.effectiveWager.reduce((s, v) => s + v, 0);
    if (totalM <= 0) return 0;
    return t.effectiveWager.reduce((s, v, i) => s + v * t.scores[i], 0) / totalM;
  }, [t]);

  return (
    <PlatformLayout>
      <SectionHeading
        as={1}
        eyebrow="Be a forecaster"
        title="Post a forecast, stake a deposit, watch it settle"
        subtitle="Your quantile fan is scored by the pinball CRPS, gated by your skill, and settled against the wager-weighted mean. Tilting away from your true belief loses in expectation."
        companion={<ThesisRef viewKey="platform/forecast" />}
        actions={<Tag tone="info" size="md">Round {game.currentRound}</Tag>}
      />

      <div style={{ marginTop: SPACE[6] }}>
        <StepRibbon active={phase} onSelect={onSelectPhase} />
        <p
          aria-live="polite"
          data-testid="phase-caption"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: TYPE.caption.size,
            color: 'var(--ink-soft)',
            margin: `${SPACE[3]}px 0 0`,
          }}
        >
          <span style={{ fontWeight: 700, color: SEM[STEP_CONCEPTS[phase]].main }}>
            Step {phase + 1} of {STEP_TITLES.length}: {STEP_TITLES[phase]}.
          </span>{' '}
          {PHASE_NOTES[phase]}
          {!settled && phase > PREVIEWABLE_PHASES ? ' Stepping here settles the round.' : ''}
        </p>
      </div>

      <div
        className="forecast-flow-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: SPACE[8],
          marginTop: SPACE[8],
          alignItems: 'start',
        }}
      >
        {/* Composer / settlement fan */}
        <Card elevation="raised" padding="roomy">
          <ChartScroller label="Your quantile forecast fan">
            <QuantileFan
              quantiles={settled ? settled.submittedFan : fan}
              taus={TAUS}
              editable={!settled}
              onChange={setFan}
              outcome={showOutcome && t ? t.y : undefined}
              accent={visitorColour}
              title={showOutcome ? 'Your forecast, scored against the outcome' : 'Compose your quantile forecast'}
              ariaLabel="Your quantile forecast fan"
              data-testid="forecast-composer-fan"
            />
          </ChartScroller>
          {!settled && (
            <div style={{ marginTop: SPACE[5], display: 'flex', gap: SPACE[4], alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={onBeHonest} data-testid="be-honest">
                Snap to my honest belief
              </Button>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)' }}>
                The honest fan is the DGP&apos;s true conditional quantiles. It maximises your expected score.
              </span>
            </div>
          )}
        </Card>

        {/* Controls + outcome */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[5] }}>
          {!settled ? (
            <Card padding="default">
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: TYPE.h3.size, lineHeight: TYPE.h3.lineHeight, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>
                Your deposit
              </h2>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-soft)', margin: `${SPACE[2]}px 0 ${SPACE[4]}px` }}>
                Risk a fraction of your wealth of {game.visitorWealth.toFixed(2)}.
              </p>
              <label style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: TYPE.label.size, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: SPACE[2] }}>
                Deposit fraction: {(riskPct * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min={0.02}
                max={0.6}
                step={0.01}
                value={riskPct}
                onChange={(e) => setRiskPct(parseFloat(e.target.value))}
                aria-label="Deposit fraction of wealth"
                style={{ width: '100%' }}
                data-testid="deposit-slider"
              />
              <dl style={{ margin: `${SPACE[4]}px 0 0`, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: SPACE[2], fontFamily: 'var(--font-sans)', fontSize: TYPE.body.size }}>
                {/* Preview numbers render in ink for AA contrast at this small
                    size; each is identified by its adjacent term. */}
                <dt style={{ color: 'var(--ink-soft)' }}>Deposit b</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', fontWeight: 600 }}>{previewDeposit.toFixed(2)}</dd>
                <dt style={{ color: 'var(--ink-soft)' }}>Skill gate g(&sigma;)</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', fontWeight: 600 }}>{gate.toFixed(3)}</dd>
                <dt style={{ color: 'var(--ink-soft)' }}>Effective wager m</dt>
                <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)', fontWeight: 600 }} data-testid="preview-wager">{previewWager.toFixed(2)}</dd>
              </dl>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: TYPE.label.size, color: 'var(--ink-faint)', margin: `${SPACE[3]}px 0 0` }}>
                m = b &middot; g(&sigma;), &nbsp; g(&sigma;) = &lambda; + (1 &minus; &lambda;)&sigma;<sup>&eta;</sup>
              </p>
              <div style={{ marginTop: SPACE[5] }}>
                <Button size="lg" onClick={() => onSettle(6)} data-testid="settle-button" style={{ width: '100%' }}>
                  Submit &amp; settle the round
                </Button>
              </div>
            </Card>
          ) : (
            <motion.div {...fadeUp(0)} aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: SPACE[4] }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE[3], paddingBottom: SPACE[3], borderBottom: '1px solid var(--border)' }}>
                <Tag tone="neutral" size="sm">Round settled</Tag>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)' }}>
                  Your deposit is now scored and the pool has cleared.
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE[4] }}>
                <StatTile
                  label="Your score s"
                  value={t!.scores[vi].toFixed(3)}
                  accent="score"
                  sublabel={`mean s̄ = ${meanScore.toFixed(3)}`}
                />
                <StatTile
                  label="Your profit"
                  value={t!.profit[vi] >= 0 ? `+${t!.profit[vi].toFixed(2)}` : t!.profit[vi].toFixed(2)}
                  accent="payoff"
                  delta={{ value: t!.profit[vi] >= 0 ? 'above mean' : 'below mean', direction: t!.profit[vi] >= 0 ? 'up' : 'down' }}
                  sublabel="m(s &minus; s̄)"
                />
                <StatTile
                  label="Payoff &Pi;"
                  value={t!.totalPayoff[vi].toFixed(2)}
                  accent="payoff"
                  sublabel="m(1 + s &minus; s̄)"
                />
                <StatTile
                  label="Skill &sigma; next"
                  value={t!.sigma_new[vi].toFixed(3)}
                  accent="skill"
                  delta={{ value: (t!.sigma_new[vi] - t!.sigma_t[vi]).toFixed(3), direction: t!.sigma_new[vi] >= t!.sigma_t[vi] ? 'up' : 'down' }}
                  sublabel={`from σ = ${t!.sigma_t[vi].toFixed(3)}`}
                />
              </div>
              <Card padding="compact">
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: SPACE[2], fontFamily: 'var(--font-sans)', fontSize: TYPE.body.size }}>
                  <dt style={{ color: 'var(--ink-soft)' }}>Outcome y</dt>
                  <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', color: SEM.outcome.main, fontWeight: 600 }} data-testid="settled-outcome">{t!.y.toFixed(3)}</dd>
                  <dt style={{ color: 'var(--ink-soft)' }}>Effective wager m</dt>
                  <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }} data-testid="settled-wager">{t!.effectiveWager[vi].toFixed(3)}</dd>
                  <dt style={{ color: 'var(--ink-soft)' }}>Refund b &minus; m</dt>
                  <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{t!.refunds[vi].toFixed(3)}</dd>
                  <dt style={{ color: 'var(--ink-soft)' }}>Wealth after</dt>
                  <dd style={{ margin: 0, fontVariantNumeric: 'tabular-nums', color: SEM.wealth.main, fontWeight: 600 }} data-testid="settled-wealth">{t!.wealth_after[vi].toFixed(2)}</dd>
                </dl>
              </Card>
              <Button size="lg" onClick={onNext} variant="secondary" data-testid="next-round" style={{ width: '100%' }}>
                Play another round
              </Button>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)', margin: 0 }}>
                You have played {game.history.length} round{game.history.length === 1 ? '' : 's'}. See your trajectory on
                {' '}<a href="#/platform/account" style={{ color: 'var(--imperial)' }}>My account</a>.
              </p>
            </motion.div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          /* minmax(0, 1fr), not a bare 1fr: a bare 1fr is minmax(auto, 1fr),
             whose auto minimum is the column's min-content. The chart card's
             min-content is the fan's legible width, which would push the
             single column wider than a phone viewport. minmax(0, ...) lets
             the track shrink and the ChartScroller handle the fan. */
          .forecast-flow-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>

      <StoryNav current={1} />
    </PlatformLayout>
  );
}
