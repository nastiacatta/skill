/**
 * Tests for the printable SummaryPage.
 *
 * Verifies:
 * - every headline number on the page equals the registry `expected`, read
 *   from claims.ts the same way the provenance gate does
 * - the synthetic-vs-real note names the right zones
 * - the "where to read more" links point at the intended routes
 * - the "Print this summary" button is wired to window.print
 * - no hard-coded numeric literal appears in SummaryPage.tsx (grep guard,
 *   mirroring the provenance discipline)
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import SummaryPage from '@/pages/SummaryPage';
import { claimById, formatClaimValue } from '@/lib/platform/summaryClaims';

afterEach(cleanup);

const HEADLINE_IDS = [
  'C1',
  'C2',
  'C3-lower',
  'C3-upper',
  'C4-Teval',
  'C4-n',
  'C6',
  'C10-dm',
  'C10-p',
];

function renderPage() {
  return render(
    <MemoryRouter>
      <SummaryPage />
    </MemoryRouter>,
  );
}

describe('SummaryPage', () => {
  it('shows each headline claim label and its registry-formatted value', () => {
    renderPage();
    for (const id of HEADLINE_IDS) {
      const claim = claimById(id);
      expect(claim, `claim ${id} must exist in the registry`).toBeDefined();
      if (!claim) continue;
      expect(screen.getByText(claim.label)).toBeDefined();
      // The displayed value is the shared registry formatter output, so it can
      // never be hand-typed or drift from the gate-checked `expected`.
      const value = formatClaimValue(claim);
      expect(screen.getAllByText(value).length).toBeGreaterThan(0);
    }
  });

  it('names the synthetic and real zones in the honesty note', () => {
    renderPage();
    expect(screen.getByText(/Synthetic sandbox: Forecast, Market, Account, Leaderboard/)).toBeDefined();
    expect(screen.getByText(/Real data: Evidence .* and Operator/)).toBeDefined();
  });

  it('links to the intended routes in where-to-read-more', () => {
    renderPage();
    const expectRoute = (label: string, to: string) => {
      const link = screen.getByRole('link', { name: new RegExp(`^${label}$`) });
      expect(link.getAttribute('href')).toContain(to);
    };
    expectRoute('Evidence', '/evidence');
    expectRoute('Robustness', '/robustness');
    expectRoute('Audit', '/audit');
    expectRoute('Notes', '/notes');
  });

  it('wires the print button to window.print', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Print this summary' }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it('does not hand-type any headline figure (provenance discipline)', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../pages/SummaryPage.tsx'),
      'utf8',
    );
    // The figures must flow from the registry at runtime, never be typed into
    // the page. For each headline claim, neither its raw `expected` string nor
    // its formatted display string may appear as a source literal. (Single-digit
    // values such as the panel size n=7 are excluded: a bare "7" is ambiguous
    // with styling, and that figure is covered by the render-equals test above.)
    for (const id of HEADLINE_IDS) {
      const claim = claimById(id);
      if (!claim) continue;
      const raw = String(claim.expected);
      const formatted = formatClaimValue(claim);
      if (raw.replace(/[^0-9]/g, '').length >= 2) {
        expect(src.includes(raw), `${id}: raw value ${raw} is hand-typed in the source`).toBe(false);
        expect(src.includes(formatted), `${id}: formatted value ${formatted} is hand-typed in the source`).toBe(false);
      }
    }
  });
});
