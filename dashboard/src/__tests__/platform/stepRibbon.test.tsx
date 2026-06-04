import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import StepRibbon, { STEP_LABELS } from '@/components/platform/viz/StepRibbon';
import ForecastFlowPage from '@/pages/platform/ForecastFlowPage';

afterEach(cleanup);

describe('StepRibbon — clickable, accessible, colour-coded', () => {
  it('renders disabled, non-current steps when no onSelect is given', () => {
    render(<StepRibbon active={3} />);
    for (let i = 0; i < STEP_LABELS.length; i++) {
      const step = screen.getByTestId(`step-ribbon-step-${i}`) as HTMLButtonElement;
      expect(step.disabled).toBe(true);
    }
  });

  it('makes every step a clickable button when onSelect is supplied', () => {
    const onSelect = vi.fn();
    render(<StepRibbon active={0} onSelect={onSelect} />);
    for (let i = 0; i < STEP_LABELS.length; i++) {
      const step = screen.getByTestId(`step-ribbon-step-${i}`) as HTMLButtonElement;
      expect(step.disabled).toBe(false);
    }
    fireEvent.click(screen.getByTestId('step-ribbon-step-4'));
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it('tracks the active step with aria-current="step" and a roving tabindex', () => {
    render(<StepRibbon active={2} onSelect={() => {}} />);
    const active = screen.getByTestId('step-ribbon-step-2');
    expect(active.getAttribute('aria-current')).toBe('step');
    expect(active.getAttribute('tabindex')).toBe('0');
    // Non-active steps are reachable by arrow keys, not Tab.
    expect(screen.getByTestId('step-ribbon-step-0').getAttribute('tabindex')).toBe('-1');
    // Only one step is current at a time.
    expect(screen.getByTestId('step-ribbon-step-0').getAttribute('aria-current')).toBeNull();
  });

  it('moves between phases with the arrow / Home / End keys', () => {
    const onSelect = vi.fn();
    render(<StepRibbon active={3} onSelect={onSelect} />);
    const active = screen.getByTestId('step-ribbon-step-3');
    fireEvent.keyDown(active, { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenLastCalledWith(4);
    fireEvent.keyDown(active, { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(active, { key: 'Home' });
    expect(onSelect).toHaveBeenLastCalledWith(0);
    fireEvent.keyDown(active, { key: 'End' });
    expect(onSelect).toHaveBeenLastCalledWith(STEP_LABELS.length - 1);
  });

  it('flags Submit and Settle as the round bookends', () => {
    render(<StepRibbon active={0} onSelect={() => {}} />);
    expect(within(screen.getByTestId('step-ribbon-step-0')).getByText('Start')).toBeDefined();
    const last = STEP_LABELS.length - 1;
    expect(within(screen.getByTestId(`step-ribbon-step-${last}`)).getByText('End')).toBeDefined();
  });

  it('marks completed steps done and the active step active via data-state', () => {
    render(<StepRibbon active={3} onSelect={() => {}} />);
    expect(screen.getByTestId('step-ribbon-step-1').getAttribute('data-state')).toBe('done');
    expect(screen.getByTestId('step-ribbon-step-3').getAttribute('data-state')).toBe('active');
    expect(screen.getByTestId('step-ribbon-step-5').getAttribute('data-state')).toBe('todo');
  });
});

describe('ForecastFlowPage — stepping the round phases', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <ForecastFlowPage />
      </MemoryRouter>,
    );
  }

  it('starts on the Submit phase (step 0 active)', () => {
    renderPage();
    expect(screen.getByTestId('step-ribbon-step-0').getAttribute('aria-current')).toBe('step');
  });

  it('clicking a previewable step changes the active phase without settling', () => {
    renderPage();
    // Gate is phase 2: previewable, so the composer (pre-settle) stays.
    fireEvent.click(screen.getByTestId('step-ribbon-step-2'));
    expect(screen.getByTestId('step-ribbon-step-2').getAttribute('aria-current')).toBe('step');
    expect(screen.getByTestId('step-ribbon-step-0').getAttribute('aria-current')).toBeNull();
    // Still composing: the composer fan and deposit slider remain.
    expect(screen.getByTestId('forecast-composer-fan')).toBeDefined();
    expect(screen.getByTestId('deposit-slider')).toBeDefined();
  });

  it('clicking a post-gate step settles the round and jumps to that phase', () => {
    renderPage();
    // Score is phase 5: needs the computed round, so selecting it settles.
    fireEvent.click(screen.getByTestId('step-ribbon-step-5'));
    expect(screen.getByTestId('step-ribbon-step-5').getAttribute('aria-current')).toBe('step');
    // Settled view is shown: real trace numbers are present.
    expect(screen.getByTestId('settled-outcome')).toBeDefined();
  });

  it('updates the phase caption when the active step changes', () => {
    renderPage();
    const caption = screen.getByTestId('phase-caption');
    const before = caption.textContent;
    fireEvent.click(screen.getByTestId('step-ribbon-step-1'));
    expect(screen.getByTestId('phase-caption').textContent).not.toBe(before);
    expect(screen.getByTestId('phase-caption').textContent).toContain('Deposit');
  });
});
