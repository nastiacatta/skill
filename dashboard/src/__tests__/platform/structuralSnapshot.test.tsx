import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import QuantileFan from '@/components/platform/viz/QuantileFan';
import ReliabilityDiagram from '@/components/platform/viz/ReliabilityDiagram';
import TrajectoryChart from '@/components/platform/viz/TrajectoryChart';
import StepRibbon from '@/components/platform/viz/StepRibbon';
import StatTile from '@/components/platform/ui/StatTile';
import MarketFloor from '@/components/platform/market/MarketFloor';
import TransportControls from '@/components/platform/market/TransportControls';
import ClientChooser from '@/components/platform/ClientChooser';
import ThesisRef from '@/components/dashboard/ThesisRef';

import { TAUS } from '@/lib/coreMechanism/dgpSimulator';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { outline, installReducedMotion } from '../_helpers/structuralSnapshot';

/**
 * O6 structural snapshots.
 *
 * These lock the *shape* of each hero surface: which elements exist, their
 * semantic attributes (testid, role, aria, href, data-state), and their leaf
 * text — never inline style or animated coordinates. They render with
 * reduced-motion forced ON, so framer-motion paints the final state with no
 * animation clock and no time dependence. Run twice on the same input they
 * produce byte-identical output; a silent change to the DOM/SVG structure or
 * the semantic wiring trips them, while a pure geometry refactor (covered by
 * the numeric suites) does not.
 *
 * A fixed seed (42) drives the one trace-backed surface (MarketFloor), so its
 * forecaster rows, weight labels, and outcome marker are deterministic.
 */

beforeEach(() => installReducedMotion(true));
afterEach(cleanup);

/** A fixed, hand-authored quantile fan (monotone, on [0, 1]). */
const FAN_Q = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
/** A fixed calibration curve (perfectly-calibrated reference shape). */
const CALIB = TAUS.map((tau) => ({ tau, coverage: tau }));
/** Two fixed trajectory series (one solid, one dashed baseline). */
const TRAJ = [
  { label: 'mechanism', data: [0.1, 0.2, 0.3, 0.4], colour: '#2E8B8B' },
  { label: 'uniform', data: [0.1, 0.15, 0.2, 0.25], colour: '#64748b', dash: '4 4' },
];

/** Deterministic single-round trace (seed 42), the exact market-view config. */
const FIXED_TRACE = runPipeline({
  dgpId: 'latent_fixed',
  behaviourPreset: 'baseline',
  weighting: 'full',
  rounds: 80,
  seed: 42,
  n: 6,
  mechanism: { lam: 0.3, eta: 1, sigma_min: 0.1 },
}).traces[0];

describe('structural snapshot — forecast fan', () => {
  it('locks the fan band group, median, ticks and outcome marker', () => {
    render(<QuantileFan quantiles={FAN_Q} taus={TAUS} outcome={0.55} data-testid="fan" />);
    expect(outline(screen.getByTestId('fan'))).toMatchSnapshot();
  });

  it('locks the editable fan handles (slider roles)', () => {
    render(<QuantileFan quantiles={FAN_Q} taus={TAUS} editable onChange={() => {}} data-testid="fan-edit" />);
    expect(outline(screen.getByTestId('fan-edit'))).toMatchSnapshot();
  });
});

describe('structural snapshot — reliability diagram', () => {
  it('locks the diagonal, axis ticks and one marker per quantile level', () => {
    render(<ReliabilityDiagram points={CALIB} data-testid="reliability" />);
    expect(outline(screen.getByTestId('reliability'))).toMatchSnapshot();
  });
});

describe('structural snapshot — trajectory chart', () => {
  it('locks the per-series paths, end markers and labels', () => {
    render(<TrajectoryChart series={TRAJ} ariaLabel="bankroll" yLabel="wealth" data-testid="traj" />);
    expect(outline(screen.getByTestId('traj'))).toMatchSnapshot();
  });
});

describe('structural snapshot — step ribbon', () => {
  it('locks the seven steps, their states and bookend labels (interactive)', () => {
    const { container } = render(<StepRibbon active={3} onSelect={() => {}} />);
    expect(outline(container.querySelector('ol'))).toMatchSnapshot();
  });

  it('locks the non-interactive (disabled) ribbon shape', () => {
    const { container } = render(<StepRibbon active={0} />);
    expect(outline(container.querySelector('ol'))).toMatchSnapshot();
  });
});

describe('structural snapshot — stat tiles', () => {
  it('locks the headline tile with unit and delta', () => {
    const { container } = render(
      <StatTile label="Mechanism vs uniform" value="-7.1" unit="%" size="xl" accent="aggregate" delta={{ value: 'sharper', direction: 'down' }} sublabel="aggregate CRPS gap" />,
    );
    expect(outline(container.querySelector('.platform-stat-tile'))).toMatchSnapshot();
  });

  it('locks the plain supporting tile', () => {
    const { container } = render(<StatTile label="Deposits in" value="12.40" accent="deposit" />);
    expect(outline(container.querySelector('.platform-stat-tile'))).toMatchSnapshot();
  });
});

describe('structural snapshot — market floor', () => {
  it('locks the per-forecaster ribbons, aggregate band and outcome marker (seed 42)', () => {
    render(<MarketFloor trace={FIXED_TRACE} n={6} />);
    expect(outline(screen.getByTestId('market-floor'), { includeText: false })).toMatchSnapshot();
  });
});

describe('structural snapshot — transport controls', () => {
  it('locks the play/step/scrub/speed toolbar shape', () => {
    const { container } = render(
      <TransportControls round={0} totalRounds={80} isPlaying={false} onToggle={() => {}} onStep={() => {}} onScrub={() => {}} onRestart={() => {}} speedMs={2400} onSpeed={() => {}} />,
    );
    expect(outline(container.querySelector('[role="toolbar"]'))).toMatchSnapshot();
  });
});

describe('structural snapshot — client chooser', () => {
  it('locks the three domain cards, their tags, CTAs and routes', () => {
    render(
      <MemoryRouter>
        <ClientChooser />
      </MemoryRouter>,
    );
    expect(outline(screen.getByTestId('client-chooser'))).toMatchSnapshot();
  });
});

describe('structural snapshot — companion signposting', () => {
  it('locks the market companion line structure', () => {
    const { container } = render(
      <MemoryRouter>
        <ThesisRef viewKey="platform/market" />
      </MemoryRouter>,
    );
    expect(outline(container.firstElementChild)).toMatchSnapshot();
  });
});
