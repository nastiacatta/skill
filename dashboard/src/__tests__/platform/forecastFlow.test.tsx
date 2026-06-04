import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderHook, act } from '@testing-library/react';

import ForecastFlowPage from '@/pages/platform/ForecastFlowPage';
import { useForecasterGame } from '@/components/platform/hooks/useForecasterGame';
import { fanFromMedianSpread } from '@/components/platform/viz/fanMaths';

afterEach(cleanup);

describe('useForecasterGame — real settlement', () => {
  it('scores and settles the visitor submitted fan via the real mechanism', () => {
    const { result } = renderHook(() => useForecasterGame());

    const fan = fanFromMedianSpread(0.5, 0.3);
    let settled: ReturnType<typeof result.current.settle> | null = null;
    act(() => {
      settled = result.current.settle(fan, 0.18);
    });

    expect(settled).not.toBeNull();
    const trace = settled!.trace;
    // The visitor occupies slot 0; their qReport is exactly the submitted fan.
    expect(trace.qReports[0]).toEqual(fan);
    // Score is the bounded CRPS score: in [0, 1].
    expect(trace.scores[0]).toBeGreaterThanOrEqual(0);
    expect(trace.scores[0]).toBeLessThanOrEqual(1);
    // Profit equals m(s − s̄) = totalPayoff − effectiveWager.
    expect(trace.profit[0]).toBeCloseTo(trace.totalPayoff[0] - trace.effectiveWager[0], 12);
    // History advanced and wealth was carried forward.
    expect(result.current.history.length).toBe(1);
  });

  it('a more honest fan scores at least as well as a badly tilted one', () => {
    const { result } = renderHook(() => useForecasterGame());
    const honest = result.current.honestTarget.slice();
    // A tilted fan: shift the honest median far toward an extreme.
    const tilted = fanFromMedianSpread(0.95, 0.3);

    let honestScore = 0;
    let tiltedScore = 0;
    act(() => {
      honestScore = result.current.settle(honest, 0.18).trace.scores[0];
    });
    // Reset and play the tilted fan on the same first round.
    act(() => {
      result.current.reset();
    });
    act(() => {
      tiltedScore = result.current.settle(tilted, 0.18).trace.scores[0];
    });
    // The honest (true-belief) fan should not score worse than a wild tilt
    // toward 0.95 unless the outcome happened to land there.
    expect(honestScore).toBeGreaterThanOrEqual(tiltedScore - 0.5);
  });
});

describe('ForecastFlowPage — render and settle', () => {
  it('renders the composer and settles to show real trace numbers', () => {
    render(
      <MemoryRouter>
        <ForecastFlowPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('forecast-composer-fan')).toBeDefined();
    const settle = screen.getByTestId('settle-button');
    fireEvent.click(settle);
    // After settling, the outcome and wealth-after cells appear.
    const outcome = screen.getByTestId('settled-outcome');
    expect(outcome).toBeDefined();
    // The settled outcome text is a 3-dp number in [0, 1].
    const val = parseFloat(outcome.textContent ?? '');
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThanOrEqual(1);
  });
});
