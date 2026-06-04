import { Button } from '@/components/platform/ui';
import { TYPE, SPACE } from '@/components/platform/designTokens';

/**
 * Lightweight guided through-line for the platform showcase. It gives a
 * first-time visitor a linear path: understand the idea, be a forecaster for
 * one round, watch the market over many rounds, see your standing, then read
 * the evidence. Each view shows where it sits in that path and a single
 * "continue" affordance to the next step. This is not a wizard: every view is
 * still reachable on its own from the rail.
 */
export interface StoryStep {
  to: string;
  label: string;
}

/** The canonical first-visit order. */
export const STORY_STEPS: StoryStep[] = [
  { to: '#/platform', label: 'The idea' },
  { to: '#/platform/forecast', label: 'Be a forecaster' },
  { to: '#/platform/market', label: 'Watch the market' },
  { to: '#/platform/account', label: 'Your standing' },
  { to: '#/platform/leaderboard', label: 'The panel' },
  { to: '#/evidence', label: 'The evidence' },
];

export interface StoryNavProps {
  /** Zero-based index of the current step in STORY_STEPS. */
  current: number;
  className?: string;
}

export default function StoryNav({ current, className = '' }: StoryNavProps) {
  const next = STORY_STEPS[current + 1];
  return (
    <nav
      aria-label="Guided tour"
      className={`platform-story-nav ${className}`.trim()}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACE[4],
        flexWrap: 'wrap',
        marginTop: SPACE[8],
        paddingTop: SPACE[5],
        borderTop: '1px solid var(--border)',
      }}
    >
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[2],
          listStyle: 'none',
          margin: 0,
          padding: 0,
          flexWrap: 'wrap',
        }}
      >
        {STORY_STEPS.map((step, i) => {
          const state = i < current ? 'done' : i === current ? 'active' : 'todo';
          const colour =
            state === 'active' ? 'var(--ink)' : state === 'done' ? 'var(--teal)' : 'var(--ink-faint)';
          return (
            <li key={step.to} style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
              <a
                href={step.to}
                aria-current={state === 'active' ? 'step' : undefined}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: TYPE.label.size,
                  fontWeight: state === 'active' ? 700 : 600,
                  color: colour,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.6, marginRight: 4 }}>{i + 1}</span>
                {step.label}
              </a>
              {i < STORY_STEPS.length - 1 && (
                <span aria-hidden="true" style={{ color: 'var(--ink-faint)' }}>
                  &rsaquo;
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {next && (
        <Button as="a" href={next.to} size="md" variant="secondary" data-testid="story-continue">
          Continue: {next.label} &rarr;
        </Button>
      )}
    </nav>
  );
}
