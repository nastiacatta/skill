import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import QuantileFan from '@/components/platform/viz/QuantileFan';
import ReliabilityDiagram from '@/components/platform/viz/ReliabilityDiagram';
import { TAUS } from '@/lib/coreMechanism/dgpSimulator';

afterEach(cleanup);

describe('QuantileFan', () => {
  const q = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

  it('renders the four nested coverage bands and an outcome marker', () => {
    render(<QuantileFan quantiles={q} taus={TAUS} outcome={0.55} />);
    expect(screen.getByTestId('fan-band-80%')).toBeDefined();
    expect(screen.getByTestId('fan-band-60%')).toBeDefined();
    expect(screen.getByTestId('fan-band-40%')).toBeDefined();
    expect(screen.getByTestId('fan-band-20%')).toBeDefined();
    expect(screen.getByTestId('fan-outcome')).toBeDefined();
  });

  it('exposes draggable handles only in editable mode', () => {
    const { rerender } = render(<QuantileFan quantiles={q} taus={TAUS} />);
    expect(screen.queryByRole('slider', { name: /median/i })).toBeNull();
    rerender(<QuantileFan quantiles={q} taus={TAUS} editable onChange={() => {}} />);
    expect(screen.getByRole('slider', { name: /median/i })).toBeDefined();
    expect(screen.getByRole('slider', { name: /spread/i })).toBeDefined();
  });
});

describe('ReliabilityDiagram', () => {
  it('renders one marker per quantile level', () => {
    const points = TAUS.map((tau) => ({ tau, coverage: tau }));
    render(<ReliabilityDiagram points={points} />);
    for (const tau of TAUS) {
      expect(screen.getByTestId(`reliability-point-${tau}`)).toBeDefined();
    }
  });
});
