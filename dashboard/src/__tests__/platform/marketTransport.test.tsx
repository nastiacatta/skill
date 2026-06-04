import { render, screen, cleanup, fireEvent, renderHook, act } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import MarketPage from '@/pages/platform/MarketPage';
import {
  useMarketSimulation,
  DEFAULT_INTERVAL_MS,
} from '@/components/platform/hooks/useMarketSimulation';
import { installReducedMotion } from '../_helpers/structuralSnapshot';

/**
 * O6 interaction coverage for the market clock — the play / pause / step / scrub
 * transport that `views.test.tsx` only renders, never drives.
 *
 * The clock is the one timer-bearing flow on the platform, so determinism needs
 * care: we assert *outcomes* (the round index, the play state, the readout), not
 * timings, and we drive the auto-advance with fake timers so no test waits on a
 * real 2.4s interval. Reduced-motion is forced ON so MarketFloor and the tiles
 * paint their final state with no animation clock.
 */

beforeEach(() => installReducedMotion(true));
afterEach(() => {
  // Restore real timers BEFORE unmount so React's scheduler (which relies on
  // setTimeout / microtasks) is not left running on a faked clock during cleanup.
  vi.useRealTimers();
  cleanup();
});

describe('useMarketSimulation — clock control (outcomes, not timings)', () => {
  it('starts paused on round 0', () => {
    const { result } = renderHook(() => useMarketSimulation({ rounds: 80 }));
    expect(result.current.round).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.totalRounds).toBe(80);
  });

  it('steps forward and back, clamped within the trace, never wrapping past an edge step', () => {
    const { result } = renderHook(() => useMarketSimulation({ rounds: 80 }));
    act(() => result.current.step(1));
    expect(result.current.round).toBe(1);
    act(() => result.current.step(5));
    expect(result.current.round).toBe(6);
    act(() => result.current.step(-2));
    expect(result.current.round).toBe(4);
  });

  it('scrubs to an explicit round', () => {
    const { result } = renderHook(() => useMarketSimulation({ rounds: 80 }));
    act(() => result.current.setRound(40));
    expect(result.current.round).toBe(40);
  });

  it('toggles play state without advancing on its own', () => {
    const { result } = renderHook(() => useMarketSimulation({ rounds: 80 }));
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
    // No timers fired: round is unchanged by toggling alone.
    expect(result.current.round).toBe(0);
  });

  it('auto-advances one round per interval while playing, then auto-pauses at the last round', () => {
    // Fake only the interval timers the hook uses; leave the microtask/timeout
    // machinery RTL and React rely on untouched, so renderHook still flushes.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { result } = renderHook(() => useMarketSimulation({ rounds: 4 }));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);

    act(() => vi.advanceTimersByTime(DEFAULT_INTERVAL_MS));
    expect(result.current.round).toBe(1);
    act(() => vi.advanceTimersByTime(DEFAULT_INTERVAL_MS));
    expect(result.current.round).toBe(2);
    // One more interval lands on the final round (index 3) and auto-pauses.
    act(() => vi.advanceTimersByTime(DEFAULT_INTERVAL_MS));
    expect(result.current.round).toBe(3);
    expect(result.current.isPlaying).toBe(false);

    // Further ticks do nothing: the clock is parked at the end.
    act(() => vi.advanceTimersByTime(DEFAULT_INTERVAL_MS * 3));
    expect(result.current.round).toBe(3);
  });

  it('restart returns to round 0 and pauses', () => {
    const { result } = renderHook(() => useMarketSimulation({ rounds: 80 }));
    act(() => result.current.setRound(50));
    act(() => result.current.toggle());
    act(() => result.current.restart());
    expect(result.current.round).toBe(0);
    expect(result.current.isPlaying).toBe(false);
  });

  it('play from the last round rewinds to 0 before running', () => {
    const { result } = renderHook(() => useMarketSimulation({ rounds: 10 }));
    act(() => result.current.setRound(9));
    act(() => result.current.play());
    expect(result.current.round).toBe(0);
    expect(result.current.isPlaying).toBe(true);
  });
});

describe('MarketPage — transport wired to the live floor', () => {
  function renderMarket() {
    return render(
      <MemoryRouter>
        <MarketPage />
      </MemoryRouter>,
    );
  }

  it('opens paused on round 1 with the floor and toggle present', () => {
    renderMarket();
    expect(screen.getByTestId('market-floor')).toBeDefined();
    const toggle = screen.getByTestId('transport-toggle');
    expect(toggle.textContent).toBe('Play');
    expect(screen.getByText('Round 1 / 80')).toBeDefined();
  });

  it('the play/pause control flips its label when toggled', () => {
    renderMarket();
    const toggle = screen.getByTestId('transport-toggle');
    fireEvent.click(toggle);
    expect(screen.getByTestId('transport-toggle').textContent).toBe('Pause');
    fireEvent.click(screen.getByTestId('transport-toggle'));
    expect(screen.getByTestId('transport-toggle').textContent).toBe('Play');
  });

  it('scrubbing the round slider updates the round readout', () => {
    renderMarket();
    const scrubber = screen.getByTestId('round-scrubber') as HTMLInputElement;
    fireEvent.change(scrubber, { target: { value: '12' } });
    expect(screen.getByText('Round 13 / 80')).toBeDefined();
  });

  it('clicking a round-anatomy step changes the live caption', () => {
    renderMarket();
    const caption = screen.getByTestId('anatomy-caption');
    const before = caption.textContent;
    fireEvent.click(screen.getByTestId('step-ribbon-step-0'));
    expect(screen.getByTestId('anatomy-caption').textContent).not.toBe(before);
    expect(screen.getByTestId('anatomy-caption').textContent).toContain('Submit');
  });
});

describe('MarketPage — deep-link restores the panel framing', () => {
  function renderAt(search: string) {
    return render(
      <MemoryRouter initialEntries={[`/platform/market${search}`]}>
        <Routes>
          <Route path="/platform/market" element={<MarketPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('preselects the heterogeneous framing from ?panel=heterogeneous', () => {
    renderAt('?panel=heterogeneous');
    // The matching framing button renders as the primary (pressed) choice.
    const btn = screen.getByTestId('framing-heterogeneous');
    expect(btn).toBeDefined();
    // The button leads with the domain name and keeps the panel type as a sublabel.
    expect(btn.textContent).toContain('Offshore wind');
    expect(btn.textContent).toContain('Heterogeneous panel');
    // The active domain is announced as pressed.
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    // The market floor still renders for the deep-linked panel.
    expect(screen.getByTestId('market-floor')).toBeDefined();
  });

  it('preselects the homogeneous framing from ?panel=homogeneous', () => {
    renderAt('?panel=homogeneous');
    const btn = screen.getByTestId('framing-homogeneous');
    expect(btn).toBeDefined();
    // The button leads with the domain name and keeps the panel type as a sublabel.
    expect(btn.textContent).toContain('Electricity imbalance');
    expect(btn.textContent).toContain('Near-homogeneous panel');
    expect(screen.getByTestId('market-floor')).toBeDefined();
  });

  it('falls back to the default framing when the param is absent or unknown', () => {
    renderAt('?panel=nonsense');
    // Still renders a working market with the default panel.
    expect(screen.getByTestId('market-floor')).toBeDefined();
    expect(screen.getByText('Round 1 / 80')).toBeDefined();
  });

  it('preselects the chemistry framing from ?panel=chemistry_moe and nudges the panel to 12', () => {
    renderAt('?panel=chemistry_moe');
    // The third framing button renders and the floor runs the heterogeneous regime.
    const btn = screen.getByTestId('framing-chemistry_moe');
    expect(btn).toBeDefined();
    // The button leads with the domain name and keeps the panel type as a sublabel.
    expect(btn.textContent).toContain('Air quality and chemistry');
    expect(btn.textContent).toContain('Chemistry-transport panel');
    expect(screen.getByTestId('market-floor')).toBeDefined();
    // The defaultN nudge lands the panel-size slider at its maximum of 12.
    expect(screen.getByText('Forecasters: 12')).toBeDefined();
  });
});
