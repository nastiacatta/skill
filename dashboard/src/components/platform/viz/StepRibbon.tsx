import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { STAGGER, DURATION, TYPE, SPACE, TRANSITION } from '@/components/platform/designTokens';
import { SEM } from '@/lib/tokens';

/**
 * The seven-step round ribbon: Submit, Deposit, Gate, Aggregate, Outcome,
 * Score, Settle. Maps onto the draft's five within-round steps (story lock,
 * draft_match_contract.md §4).
 *
 * Each step carries its own per-phase concept colour (the same hues the rest
 * of the platform already uses for deposit, skill, wager, aggregate, outcome,
 * score and payoff), so the round reads as a coloured sequence rather than
 * seven identical greys. Submit and Settle are flagged as the round's
 * bookends. The three states are visually distinct: done steps are tinted and
 * ticked, the active step sits prominent on navy with a concept-coloured ring,
 * upcoming steps are faint and dashed. Connectors fill in as the round
 * progresses so the row reads as one sequence.
 *
 * When `onSelect` is supplied every step is a real button: click, Tab, or the
 * arrow / Home / End keys move between phases (roving tabindex), and
 * `aria-current="step"` tracks the active one. Staggered entrance and the
 * active-step lift collapse to instant under reduce-motion.
 */
export const STEP_LABELS = ['Submit', 'Deposit', 'Gate', 'Aggregate', 'Outcome', 'Score', 'Settle'] as const;

/** SEM concept key per step, aligned to STEP_LABELS. A submitted report and the
 *  combined aggregate share the forecast (imperial) hue by design; the deposit,
 *  skill gate, outcome, score and payoff steps use their own concept colours. */
export const STEP_CONCEPTS = [
  'aggregate', // Submit: the posted forecast report (forecast hue)
  'deposit',   // Deposit: the wealth put at risk, b
  'skill',     // Gate: the skill gate g(σ)
  'aggregate', // Aggregate: reports combine into r̂
  'outcome',   // Outcome: the realised y
  'score',     // Score: CRPS against the outcome
  'payoff',    // Settle: the pool pays out, Π
] as const satisfies readonly (keyof typeof SEM)[];

/** Neutral, third-person caption per step for the anatomy ribbons (Market,
 *  Landing). The forecaster flow supplies its own second-person copy. */
export const STEP_CAPTIONS = [
  'Each forecaster posts a probabilistic report.',
  'Each forecaster posts a deposit b out of their wealth.',
  'The skill gate rescales each deposit into an effective wager m.',
  'The reports combine into the wager-weighted aggregate r̂.',
  'The realised outcome y lands for the round.',
  'Each report is scored against the outcome by the pinball CRPS.',
  'The pool settles by relative score and skill updates for the next round.',
] as const;

export interface StepRibbonProps {
  /** Index of the active step (0-6). */
  active: number;
  steps?: readonly string[];
  onSelect?: (index: number) => void;
  className?: string;
}

export default function StepRibbon({ active, steps = STEP_LABELS, onSelect, className = '' }: StepRibbonProps) {
  const reduce = useReducedMotion();
  const interactive = Boolean(onSelect);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Roving keyboard navigation: arrows / Home / End move focus and select the
  // next phase, so a viewer can walk the round without a mouse.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (!onSelect) return;
    let target: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = Math.min(steps.length - 1, i + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = Math.max(0, i - 1);
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = steps.length - 1;
    if (target === null) return;
    e.preventDefault();
    onSelect(target);
    buttonRefs.current[target]?.focus();
  };

  return (
    <ol
      className={`platform-step-ribbon ${className}`.trim()}
      aria-label="Round steps"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        gap: SPACE[2],
        listStyle: 'none',
        margin: 0,
        padding: 0,
      }}
    >
      {steps.map((label, i) => {
        const state = i < active ? 'done' : i === active ? 'active' : 'todo';
        const conceptKey = STEP_CONCEPTS[i] ?? 'aggregate';
        const concept = SEM[conceptKey];
        const bookend = i === 0 ? 'start' : i === steps.length - 1 ? 'end' : null;
        const connectorDone = i <= active && i > 0;

        const bg = state === 'active' ? 'var(--navy)' : state === 'done' ? concept.light : 'var(--cream)';
        const fg = state === 'active' ? 'var(--paper)' : state === 'done' ? 'var(--ink)' : 'var(--ink-faint)';
        const border =
          state === 'active' ? 'var(--navy)' : state === 'done' ? concept.main : 'var(--border-strong)';

        const buttonStyle: CSSProperties = {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          minHeight: 56,
          padding: '8px 10px',
          borderRadius: 14,
          border: `${state === 'done' ? 2 : 1}px ${state === 'todo' ? 'dashed' : 'solid'} ${border}`,
          background: bg,
          color: fg,
          fontFamily: 'var(--font-sans)',
          fontSize: TYPE.label.size,
          fontWeight: 600,
          cursor: interactive ? 'pointer' : 'default',
          whiteSpace: 'nowrap',
          // The concept-coloured ring makes the active phase prominent while
          // keeping its hue legible on navy. Reduce-motion drops the transition.
          boxShadow: state === 'active' ? `0 0 0 3px ${concept.ring}` : 'none',
          transition: reduce ? 'none' : `box-shadow ${DURATION.fast}ms, background ${DURATION.fast}ms`,
        };

        return (
          <li
            key={label}
            style={{ display: 'flex', alignItems: 'center', flex: '1 1 96px', minWidth: 96 }}
          >
            {/* Connector before every step but the first: fills from the left
                once reached, so the round reads as a sequence in motion. */}
            {i > 0 && (
              <span
                aria-hidden="true"
                style={{
                  flex: '0 0 auto',
                  width: SPACE[2],
                  height: 2,
                  marginRight: SPACE[1],
                  borderRadius: 2,
                  background: 'var(--border-strong)',
                  overflow: 'hidden',
                }}
              >
                <motion.span
                  initial={false}
                  animate={{ scaleX: connectorDone ? 1 : 0 }}
                  transition={reduce ? { duration: 0 } : TRANSITION.reorder}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    borderRadius: 2,
                    background: 'var(--teal)',
                    transformOrigin: 'left center',
                  }}
                />
              </span>
            )}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={
                reduce
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, scale: state === 'active' ? 1.04 : 1 }
              }
              transition={reduce ? { duration: 0 } : { delay: (i * STAGGER.item) / 1000, duration: DURATION.fast / 1000 }}
              style={{ flex: '1 1 auto' }}
            >
              <button
                ref={(el) => { buttonRefs.current[i] = el; }}
                type="button"
                onClick={onSelect ? () => onSelect(i) : undefined}
                onKeyDown={(e) => onKeyDown(e, i)}
                aria-current={state === 'active' ? 'step' : undefined}
                aria-label={`${label}${bookend === 'start' ? ' (round start)' : bookend === 'end' ? ' (round end)' : ''}, step ${i + 1} of ${steps.length}`}
                tabIndex={interactive ? (i === active ? 0 : -1) : undefined}
                disabled={!interactive}
                data-testid={`step-ribbon-step-${i}`}
                data-state={state}
                style={buttonStyle}
              >
                {/* Eyebrow: a per-phase concept dot on every step; bookends are
                    additionally labelled Start / End so the round's ends read
                    at a glance. */}
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    // Text uses the ink ramp for AA contrast on the tint/cream
                    // backgrounds; the concept hue is carried by the dot + border.
                    color: fg,
                    lineHeight: 1,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: concept.main,
                      opacity: state === 'todo' ? 0.45 : 1,
                      flex: '0 0 auto',
                    }}
                  />
                  {bookend === 'start' ? 'Start' : bookend === 'end' ? 'End' : null}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    aria-hidden="true"
                    style={{
                      fontVariantNumeric: 'tabular-nums',
                      opacity: state === 'todo' ? 0.7 : 0.85,
                      fontWeight: 700,
                    }}
                  >
                    {state === 'done' ? '✓' : i + 1}
                  </span>
                  {label}
                </span>
              </button>
            </motion.div>
          </li>
        );
      })}
    </ol>
  );
}
