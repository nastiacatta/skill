import { render, cleanup } from '@testing-library/react';
import { describe, it, afterEach, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import axe from 'axe-core';

import PlatformLandingPage from '@/pages/platform/PlatformLandingPage';
import MarketPage from '@/pages/platform/MarketPage';
import AccountPage from '@/pages/platform/AccountPage';
import LeaderboardPage from '@/pages/platform/LeaderboardPage';
import OperatorPage from '@/pages/platform/OperatorPage';
import SummaryPage from '@/pages/SummaryPage';

/**
 * Accessibility regression tripwire (axe-core in jsdom).
 *
 * This test is the in-suite accessibility guard: it renders the key route components
 * and runs the axe engine, asserting zero critical or serious WCAG A/AA
 * violations so a regression (a missing label, a broken heading order, a
 * mis-roled control) fails `npm test` loudly.
 *
 * jsdom has no layout engine, so the `color-contrast` rule cannot run
 * here and is disabled; contrast is covered by the Chromium harness. All
 * other rules run.
 */

afterEach(cleanup);

/** Run axe on a rendered container, WCAG A/AA, contrast disabled in jsdom. */
async function analyse(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations;
}

/** Critical and serious are the gating impacts the brief targets. */
function blocking(violations: axe.Result[]) {
  return violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length})`);
}

const ROUTES: { name: string; ui: ReactElement }[] = [
  { name: 'platform landing', ui: <PlatformLandingPage /> },
  { name: 'market', ui: <MarketPage /> },
  { name: 'account', ui: <AccountPage /> },
  { name: 'leaderboard', ui: <LeaderboardPage /> },
  { name: 'operator', ui: <OperatorPage /> },
  { name: 'summary', ui: <SummaryPage /> },
];

describe('a11y — key routes have no critical/serious WCAG A/AA violations', () => {
  for (const { name, ui } of ROUTES) {
    it(`${name} is free of critical/serious axe violations`, async () => {
      const { container } = render(<MemoryRouter>{ui}</MemoryRouter>);
      const violations = await analyse(container);
      expect(blocking(violations)).toEqual([]);
    });
  }
});
