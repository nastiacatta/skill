/**
 * Tests for the HowToRead interpretation helper.
 *
 * Verifies:
 * - collapsed by default (the points are not shown until expanded)
 * - expands on click and shows every point
 * - no "Show the maths" toggle when `maths` is absent
 * - shows the maths toggle when `maths` is present
 * - dismissing hides it for the session and writes the sessionStorage flag
 * - renders null when the dismiss key is preset on mount
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import HowToRead from '@/components/dashboard/HowToRead';

afterEach(cleanup);
beforeEach(() => {
  try {
    window.sessionStorage.clear();
  } catch {
    // ignore
  }
});

const POINTS = [
  'Each bar is one forecaster on the panel.',
  'A bar below zero means the mechanism scored better.',
  'Lower is better, so down is good.',
];

describe('HowToRead', () => {
  it('is collapsed by default and shows no points', () => {
    render(<HowToRead id="t-collapsed" points={POINTS} />);
    const trigger = screen.getByRole('button', { name: 'How to read this' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(POINTS[0])).toBeNull();
  });

  it('expands on click and shows every point', () => {
    render(<HowToRead id="t-expand" points={POINTS} />);
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }));
    for (const p of POINTS) {
      expect(screen.getByText(p)).toBeDefined();
    }
  });

  it('renders no maths toggle when maths is absent', () => {
    render(<HowToRead id="t-nomaths" points={POINTS} />);
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }));
    expect(screen.queryByRole('button', { name: 'Show the maths' })).toBeNull();
  });

  it('renders the maths toggle and reveals the node when maths is present', () => {
    render(
      <HowToRead id="t-maths" points={POINTS} maths={<span>the pinball loss surrogate</span>} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }));
    const mathsToggle = screen.getByRole('button', { name: 'Show the maths' });
    expect(mathsToggle).toBeDefined();
    expect(screen.queryByText('the pinball loss surrogate')).toBeNull();
    fireEvent.click(mathsToggle);
    expect(screen.getByText('the pinball loss surrogate')).toBeDefined();
  });

  it('dismisses for the session and writes the storage flag', () => {
    render(<HowToRead id="t-dismiss" points={POINTS} />);
    fireEvent.click(screen.getByRole('button', { name: 'How to read this' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('button', { name: 'How to read this' })).toBeNull();
    expect(window.sessionStorage.getItem('howToRead:t-dismiss')).toBe('1');
  });

  it('renders null when the dismiss key is preset on mount', () => {
    window.sessionStorage.setItem('howToRead:t-preset', '1');
    const { container } = render(<HowToRead id="t-preset" points={POINTS} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('button', { name: 'How to read this' })).toBeNull();
  });
});
