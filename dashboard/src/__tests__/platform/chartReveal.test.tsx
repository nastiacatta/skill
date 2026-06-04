import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import QuantileFan from '@/components/platform/viz/QuantileFan';
import ReliabilityDiagram from '@/components/platform/viz/ReliabilityDiagram';
import TrajectoryChart from '@/components/platform/viz/TrajectoryChart';
import { TAUS } from '@/lib/coreMechanism/dgpSimulator';

/**
 * Chart-reveal motion (O2): the three hero charts animate their data in on
 * mount (the fan expands, the trajectory and reliability lines draw on, markers
 * settle in). The reveal must never change what is finally rendered: every data
 * element is present in the DOM in both the default and the reduced-motion
 * mode, so the entrance is purely a presentation layer over the same geometry.
 *
 * jsdom has no `matchMedia`; framer-motion's `useReducedMotion()` reads it, so
 * we stub it from a settable flag and assert the final rendered state holds
 * either way.
 */

let prefersReduced = false;

function installMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) => ({
      matches: /prefers-reduced-motion:\s*reduce/.test(query) ? prefersReduced : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  prefersReduced = false;
  installMatchMedia();
});

afterEach(cleanup);

const q = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const calib = TAUS.map((tau) => ({ tau, coverage: tau }));
const trajSeries = [
  { label: 'mechanism', data: [0.1, 0.2, 0.3, 0.4], colour: '#2E8B8B' },
  { label: 'uniform', data: [0.1, 0.15, 0.2, 0.25], colour: '#64748b', dash: '4 4' },
];

describe('chart-reveal motion keeps the final data state', () => {
  for (const reduce of [false, true]) {
    const mode = reduce ? 'reduced-motion' : 'default';

    it(`QuantileFan renders all bands and the outcome marker (${mode})`, () => {
      prefersReduced = reduce;
      render(<QuantileFan quantiles={q} taus={TAUS} outcome={0.55} />);
      for (const label of ['80%', '60%', '40%', '20%']) {
        expect(screen.getByTestId(`fan-band-${label}`)).toBeDefined();
      }
      expect(screen.getByTestId('fan-outcome')).toBeDefined();
    });

    it(`ReliabilityDiagram renders one marker per quantile level (${mode})`, () => {
      prefersReduced = reduce;
      render(<ReliabilityDiagram points={calib} />);
      for (const tau of TAUS) {
        expect(screen.getByTestId(`reliability-point-${tau}`)).toBeDefined();
      }
    });

    it(`TrajectoryChart renders every series line and end label (${mode})`, () => {
      prefersReduced = reduce;
      render(<TrajectoryChart series={trajSeries} ariaLabel="trajectory" data-testid="traj" />);
      expect(screen.getByTestId('traj')).toBeDefined();
      // Both end-of-series labels are present (solid + dashed series).
      expect(screen.getByText('mechanism')).toBeDefined();
      expect(screen.getByText('uniform')).toBeDefined();
      // One drawn path per series plus axis-free frame: at least two paths.
      const paths = document.querySelectorAll('svg path');
      expect(paths.length).toBeGreaterThanOrEqual(2);
    });
  }
});
