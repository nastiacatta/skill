/**
 * Unit tests for ImprovementPanel.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { createElement } from 'react';

import ImprovementPanel from '@/components/audit/ImprovementPanel';

function renderPanel() {
  return render(createElement(ImprovementPanel));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ImprovementPanel', () => {
  afterEach(() => { cleanup(); });
  it('renders without errors', () => {
    renderPanel();
    expect(screen.getByText('Improvement recommendations')).toBeTruthy();
  });

  it('displays all 4 category sub-tabs', () => {
    renderPanel();
    expect(screen.getByText(/^Model/)).toBeTruthy();
    expect(screen.getByText(/^Skill/)).toBeTruthy();
    expect(screen.getByText(/^Aggregation/)).toBeTruthy();
    expect(screen.getByText(/^Economic/)).toBeTruthy();
  });

  it('shows model recommendations by default', () => {
    renderPanel();
    expect(screen.getByText(/Conformal prediction wrappers/)).toBeTruthy();
  });

  it('switches to skill category on tab click', () => {
    renderPanel();
    fireEvent.click(screen.getByText(/^Skill/));
    expect(screen.getByText(/Replace EWMA with Multiplicative Weights Update/)).toBeTruthy();
  });

  it('switches to aggregation category on tab click', () => {
    renderPanel();
    fireEvent.click(screen.getByText(/^Aggregation/));
    expect(screen.getByText(/Switch to Vitali OGD per-quantile weighting/)).toBeTruthy();
  });

  it('switches to economic category on tab click', () => {
    renderPanel();
    fireEvent.click(screen.getByText(/^Economic/));
    expect(screen.getByText(/Per-quantile settlement/)).toBeTruthy();
  });

  it('displays priority badges', () => {
    renderPanel();
    const highBadges = screen.getAllByText('high');
    expect(highBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('displays evidence citations when available', () => {
    renderPanel();
    expect(screen.getAllByText(/Evidence:/).length).toBeGreaterThanOrEqual(1);
  });

  it('displays CRPS estimates when available', () => {
    renderPanel();
    expect(screen.getByText(/Estimated impact:/)).toBeTruthy();
  });
});
