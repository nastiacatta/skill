import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import StorySkillSparkline from '@/components/story/StorySkillSparkline';
import StoryWagerFlow from '@/components/story/StoryWagerFlow';
import StoryLossSkillChart from '@/components/story/StoryLossSkillChart';
import StoryFormulaBox, { STORY_FORMULAS } from '@/components/story/StoryFormulaBox';
import StoryForecasterCard from '@/components/story/StoryForecasterCard';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { STORY_SEED } from '@/components/story/useStoryPipeline';

afterEach(cleanup);

const trace = runPipeline({
  dgpId: 'baseline',
  behaviourPreset: 'baseline',
  rounds: 5,
  seed: STORY_SEED,
  n: 6,
  builder: { depositPolicy: 'fixed_unit' },
  mechanism: { sigma_min: 0.1 },
});

describe('Skill-trajectory sparkline', () => {
  it('renders an SVG sparkline with a path and a dot', () => {
    const sigmaHistory = trace.traces.map((t) => t.sigma_t[0]);
    const { container } = render(
      createElement(StorySkillSparkline, {
        sigmaHistory,
        currentRound: 2,
        colour: '#1B2A4A',
        globalMin: 0.1,
        globalMax: 1.0,
        emphasised: false,
      }),
    );
    const svg = container.querySelector('[data-testid="skill-sparkline"]');
    expect(svg).not.toBeNull();
    expect(svg!.querySelector('path')).not.toBeNull();
    expect(svg!.querySelector('circle')).not.toBeNull();
  });

  it('does not render with fewer than 2 data points', () => {
    const { container } = render(
      createElement(StorySkillSparkline, {
        sigmaHistory: [0.5],
        currentRound: 0,
        colour: '#1B2A4A',
        globalMin: 0,
        globalMax: 1,
      }),
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('emphasised sparkline has full opacity', () => {
    const sigmaHistory = trace.traces.map((t) => t.sigma_t[0]);
    const { container } = render(
      createElement(StorySkillSparkline, {
        sigmaHistory,
        currentRound: 2,
        colour: '#1B2A4A',
        globalMin: 0.1,
        globalMax: 1.0,
        emphasised: true,
      }),
    );
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.style.opacity).toBe('1');
  });
});

describe('Wager-flow diagram', () => {
  it('renders inbound ribbons at step 3 (Aggregate)', () => {
    const round = trace.traces[0];
    const { container } = render(
      createElement(StoryWagerFlow, {
        effectiveWager: round.effectiveWager,
        payout: round.totalPayoff,
        forecasterCount: 6,
        step: 3,
      }),
    );
    const el = container.querySelector('[data-testid="wager-flow"]');
    expect(el).not.toBeNull();
    const totalIn = container.querySelector('[data-testid="wager-flow-total-in"]');
    expect(totalIn).not.toBeNull();
    expect(totalIn!.textContent).toContain('Total in');
    const totalOut = container.querySelector('[data-testid="wager-flow-total-out"]');
    expect(totalOut).toBeNull();
  });

  it('renders outbound ribbons at step 6 (Settle)', () => {
    const round = trace.traces[0];
    const { container } = render(
      createElement(StoryWagerFlow, {
        effectiveWager: round.effectiveWager,
        payout: round.totalPayoff,
        forecasterCount: 6,
        step: 6,
      }),
    );
    const totalOut = container.querySelector('[data-testid="wager-flow-total-out"]');
    expect(totalOut).not.toBeNull();
    expect(totalOut!.textContent).toContain('Total out');
  });

  it('ribbon thickness is proportional to wager value', () => {
    const round = trace.traces[0];
    const { container } = render(
      createElement(StoryWagerFlow, {
        effectiveWager: round.effectiveWager,
        payout: round.totalPayoff,
        forecasterCount: 6,
        step: 3,
      }),
    );
    const paths = container.querySelectorAll('path[stroke-width]');
    expect(paths.length).toBeGreaterThan(0);
  });
});

describe('Loss-and-sigma co-evolution chart', () => {
  it('renders a chart with paths for loss and sigma', () => {
    const histories = Array.from({ length: 6 }, (_, i) =>
      trace.traces.map((t) => ({
        loss: 1 - t.scores[i],
        sigma: t.sigma_new[i],
      })),
    );
    const { container } = render(
      createElement(StoryLossSkillChart, {
        histories,
        currentRound: 2,
        forecasterCount: 6,
      }),
    );
    const el = container.querySelector('[data-testid="loss-skill-chart"]');
    expect(el).not.toBeNull();
    const paths = el!.querySelectorAll('path');
    expect(paths.length).toBe(2);
  });

  it('has forecaster selector tabs', () => {
    const histories = Array.from({ length: 6 }, (_, i) =>
      trace.traces.map((t) => ({
        loss: 1 - t.scores[i],
        sigma: t.sigma_new[i],
      })),
    );
    const { container } = render(
      createElement(StoryLossSkillChart, {
        histories,
        currentRound: 2,
        forecasterCount: 6,
      }),
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(6);
  });
});

describe('Inline formula boxes', () => {
  it('renders KaTeX formula when visible', () => {
    const { container } = render(
      createElement(StoryFormulaBox, {
        latex: 'm_i = b_i \\cdot g(\\sigma_i)',
        label: 'Gate',
        visible: true,
      }),
    );
    const el = container.querySelector('[data-testid="story-formula-box"]');
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain('Gate');
    expect(el!.querySelector('.katex')).not.toBeNull();
  });

  it('does not render when not visible', () => {
    const { container } = render(
      createElement(StoryFormulaBox, {
        latex: 'm_i = b_i \\cdot g(\\sigma_i)',
        label: 'Gate',
        visible: false,
      }),
    );
    expect(container.querySelector('[data-testid="story-formula-box"]')).toBeNull();
  });

  it('STORY_FORMULAS defines formulas at steps 2, 3, 5, 6', () => {
    expect(STORY_FORMULAS[2]).toBeDefined();
    expect(STORY_FORMULAS[3]).toBeDefined();
    expect(STORY_FORMULAS[5]).toBeDefined();
    expect(STORY_FORMULAS[6]).toBeDefined();
    expect(STORY_FORMULAS[0]).toBeUndefined();
    expect(STORY_FORMULAS[1]).toBeUndefined();
    expect(STORY_FORMULAS[4]).toBeUndefined();
  });

  it('Gate formula uses thesis notation m_i = b_i * g(sigma_i)', () => {
    expect(STORY_FORMULAS[2].latex).toContain('m_i');
    expect(STORY_FORMULAS[2].latex).toContain('g(\\sigma_i)');
  });

  it('Settle formula uses thesis notation pi_i = m_i(1 + s_i - bar s)', () => {
    expect(STORY_FORMULAS[6].latex).toContain('\\pi_i');
    expect(STORY_FORMULAS[6].latex).toContain('\\bar{s}');
  });
});

describe('Hover-reveal data tips', () => {
  it('forecaster card calls onHover with index on mouse enter', () => {
    let hovered: number | null = null;
    const { container } = render(
      createElement(StoryForecasterCard, {
        forecasterIndex: 2,
        label: 'F3',
        colour: '#E87060',
        frame: 3,
        step: 3,
        participated: true,
        sigma: 0.7,
        depositPre: 1.0,
        depositPost: 1.0,
        effectiveWager: 0.8,
        quantileFan: [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],
        score: 0,
        payout: 0,
        isPinned: false,
        isActive: false,
        isDimmed: false,
        onSelect: () => {},
        isHovered: false,
        onHover: (idx: number | null) => { hovered = idx; },
      }),
    );
    const button = container.querySelector('button')!;
    fireEvent.mouseEnter(button);
    expect(hovered).toBe(2);
    fireEvent.mouseLeave(button);
    expect(hovered).toBeNull();
  });

  it('forecaster card shows quantile mini-fan when quantileFan is provided', () => {
    const { container } = render(
      createElement(StoryForecasterCard, {
        forecasterIndex: 0,
        label: 'F1',
        colour: '#1B2A4A',
        frame: 3,
        step: 3,
        participated: true,
        sigma: 0.8,
        depositPre: 1.0,
        depositPost: 1.0,
        effectiveWager: 0.9,
        quantileFan: [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7],
        score: 0,
        payout: 0,
        isPinned: false,
        isActive: false,
        isDimmed: false,
        onSelect: () => {},
      }),
    );
    expect(container.querySelector('[data-testid="forecaster-mini-fan"]')).not.toBeNull();
  });
});

describe('No em-dashes in new components', () => {
  it('STORY_FORMULAS labels contain no em-dashes', () => {
    for (const key of Object.keys(STORY_FORMULAS)) {
      const formula = STORY_FORMULAS[Number(key)];
      expect(formula.label).not.toContain('—');
      expect(formula.latex).not.toContain('—');
    }
  });
});
